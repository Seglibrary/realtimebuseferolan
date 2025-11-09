// server.js - Real-time Translation Backend
// Gerekli paketler: npm install express ws openai dotenv cors

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import OpenAI from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// OpenAI Client - Dinamik API key ile başlatılacak
let openai = null;

// OpenAI client'ı başlat
const initializeOpenAI = (apiKey) => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
    console.log('🔑 OpenAI client initialized');
  }
  return openai;
};

// Session Management
const sessions = new Map();

// 🆕 HAFTA 3 - ADIM 3.1: Embedding Cache Sistemi
class EmbeddingCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000;
    this.ttl = 3600000; // 1 saat
  }
  
  async getEmbedding(text, openaiClient) {
    const key = text.toLowerCase().trim();
    
    if (this.cache.has(key)) {
      const cached = this.cache.get(key);
      if (Date.now() - cached.timestamp < this.ttl) {
        console.log(`💾 Embedding cache hit: "${key.substring(0, 20)}..."`);
        return cached.embedding; // Cache hit! ⚡
      }
    }
    
    // Cache miss: API call
    console.log(`🔍 Embedding cache miss: "${key.substring(0, 20)}..." - fetching from API`);
    const response = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: text
    });
    
    const embedding = response.data[0].embedding;
    
    this.cache.set(key, {
      embedding,
      timestamp: Date.now()
    });
    
    // Cache boyut kontrolü
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log(`🗑️ Embedding cache cleanup: removed oldest entry`);
    }
    
    return embedding;
  }
  
  // Cache istatistikleri
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl
    };
  }
}

// Global embedding cache instance
const embeddingCache = new EmbeddingCache();

// Cosine similarity hesaplama fonksiyonu
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

// 🆕 HAFTA 3 - ADIM 3.2: Context Similarity Check
async function checkWithEmbedding(uncertainWord, context, openaiClient) {
  console.log(`🔍 Checking "${uncertainWord}" with embedding...`);
  
  // 1. Belirsiz kelimenin embedding'i
  const wordEmbed = await embeddingCache.getEmbedding(uncertainWord, openaiClient);
  
  // 2. Context'in embedding'i
  const contextEmbed = await embeddingCache.getEmbedding(context, openaiClient);
  
  // 3. Similarity check
  const similarity = cosineSimilarity(wordEmbed, contextEmbed);
  
  console.log(`📊 Embedding similarity for "${uncertainWord}": ${similarity.toFixed(2)}`);
  
  // 4. Three-tier decision
  if (similarity >= 0.85) {
    // Çok uyumlu, muhtemelen doğru
    console.log(`✅ HIGH similarity (${similarity.toFixed(2)}) → ACCEPT_AS_IS`);
    return {
      action: 'ACCEPT_AS_IS',
      confidence: similarity,
      method: 'embedding',
      word: uncertainWord
    };
  } else if (similarity < 0.50) {
    // Çok uyumsuz, muhtemelen yanlış
    console.log(`❌ LOW similarity (${similarity.toFixed(2)}) → LIKELY_WRONG, ask GPT`);
    return {
      action: 'LIKELY_WRONG_ASK_GPT',
      confidence: similarity,
      method: 'need_gpt'
    };
  } else {
    // Belirsiz bölge (0.50-0.85)
    console.log(`⚠️ MEDIUM similarity (${similarity.toFixed(2)}) → UNCERTAIN, ask GPT`);
    return {
      action: 'UNCERTAIN_ASK_GPT',
      confidence: similarity,
      method: 'need_gpt'
    };
  }
}

// 🆕 HAFTA 3 - ADIM 3.3: Hybrid Correction (GPT helper fonksiyonu)
async function askGPTForCorrection(word, context, embeddingSimilarity, openaiClient) {
  const prompt = `Correct this uncertain word in context:

Word: "${word}"
Context: "${context}"

Embedding analysis: Similarity score is ${embeddingSimilarity.toFixed(2)} (0.0-1.0 scale).
${embeddingSimilarity < 0.50 
  ? 'Low similarity suggests the word is likely incorrect or out of context.' 
  : 'Medium similarity suggests the word might be correct or needs minor correction.'}

Task: Determine if the word needs correction. Consider:
- Phonetic similarity to context-appropriate words
- Semantic fit with the context
- Common transcription errors
- Language patterns

Return JSON:
{
  "correction": "corrected word (or same if correct)",
  "confidence": 0.95,
  "reason": "brief explanation",
  "changed": true/false
}`;

  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 150
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  
  return {
    correction: result.correction,
    confidence: result.confidence,
    changed: result.changed,
    reason: result.reason
  };
}

// 🆕 HAFTA 3 - ADIM 3.3: Hybrid Correction (Ana fonksiyon)
async function correctWithHybrid(uncertainWord, context, openaiClient) {
  console.log(`\n🔄 Hybrid correction for: "${uncertainWord}"`);
  
  // ADIM 1: Embedding pre-filter
  const embeddingResult = await checkWithEmbedding(
    uncertainWord,
    context,
    openaiClient
  );
  
  if (embeddingResult.action === 'ACCEPT_AS_IS') {
    // Kolay durum: Kelime context ile uyumlu, doğru olarak kabul et
    console.log(`✅ "${uncertainWord}" accepted (embedding confidence: ${embeddingResult.confidence.toFixed(2)})`);
    return {
      correction: uncertainWord, // Değiştirme!
      confidence: embeddingResult.confidence,
      method: 'embedding',
      fast: true
    };
  } else {
    // Zor durum: GPT'ye sor
    console.log(`🤔 "${uncertainWord}" uncertain, asking GPT (embedding: ${embeddingResult.confidence.toFixed(2)})`);
    
    const gptResult = await askGPTForCorrection(
      uncertainWord,
      context,
      embeddingResult.confidence, // Embedding skorunu ver
      openaiClient
    );
    
    console.log(`📝 GPT result: "${gptResult.correction}" (confidence: ${gptResult.confidence}, changed: ${gptResult.changed})`);
    
    return {
      correction: gptResult.correction,
      confidence: gptResult.confidence,
      method: 'gpt',
      fast: false,
      reason: gptResult.reason
    };
  }
}

class TranscriptionSession {
  constructor(ws) {
    this.ws = ws;
    this.realtimeWs = null;
    this.contextBuffer = []; // Son 60 saniye transkript
    this.pendingCorrections = [];
    this.currentContext = '';
    this.currentLanguage = 'en'; // Default language
    this.sampleRate = 24000; // Default sample rate
    this.sessionStartTime = Date.now();
    this.lastAnalysisTime = Date.now();
    
    // YENİ: Optimizasyon parametreleri
    this.minAnalysisInterval = 2000; // 5s yerine 2s
    this.transcriptsSinceLastAnalysis = 0;
    this.transcriptThreshold = 3; // 3 transcript gelince analiz et
    this.lastTranscriptTime = Date.now();
    this.correctionCache = new Map(); // Düzeltme önbelleği
    this.targetLanguage = 'en'; // Hedef çeviri dili
    
    // 🆕 ADIM 2.2: Keyword cache (performans optimizasyonu)
    this.keywordCache = new Map(); // Context → keywords mapping
    this.KEYWORD_CACHE_TTL = 60000; // 60 saniye cache
    
    // 🆕 ADIM 1.0a: Atomik ID sistemi
    this.chunkCounter = 0; // Benzersiz ID için sayaç
    this.chunksMap = new Map(); // ID → Chunk mapping
    
    // 🆕 ADIM 1.4: Cleanup mekanizması
    this.MAX_CHUNKS = 200; // Maksimum chunk sayısı
    this.CLEANUP_INTERVAL = 30000; // 30 saniye cleanup
    this.startCleanupTimer();
  }
  
  // 🆕 ADIM 1.4: Periyodik cleanup
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldChunks();
    }, this.CLEANUP_INTERVAL);
  }
  
  // 🆕 ADIM 1.4: Eski chunk'ları temizle
  cleanupOldChunks() {
    const chunkCount = this.chunksMap.size;
    
    if (chunkCount <= this.MAX_CHUNKS) {
      console.log(`✅ Chunk cleanup: ${chunkCount}/${this.MAX_CHUNKS} (OK)`);
      return;
    }
    
    // En eski chunk'ları sil (FIFO)
    const chunksToDelete = chunkCount - this.MAX_CHUNKS;
    const sortedChunks = Array.from(this.chunksMap.keys()).sort();
    
    for (let i = 0; i < chunksToDelete; i++) {
      const chunkId = sortedChunks[i];
      this.chunksMap.delete(chunkId);
      console.log(`🗑️ Deleted old chunk: ${chunkId}`);
    }
    
    console.log(`✅ Chunk cleanup: ${this.chunksMap.size}/${this.MAX_CHUNKS} (Cleaned ${chunksToDelete} chunks)`);
  }

  // Rolling context window (60 saniye)
  addToContext(text, timestamp, id) { // 🆕 YENİ: id parametresi eklendi
    this.contextBuffer.push({ id, text, timestamp }); // 🆕 id eklendi
    this.transcriptsSinceLastAnalysis++;
    this.lastTranscriptTime = timestamp;
    
    // 60 saniyeden eski kayıtları temizle
    const cutoffTime = Date.now() - 60000;
    this.contextBuffer = this.contextBuffer.filter(
      item => item.timestamp > cutoffTime
    );
    
    this.currentContext = this.contextBuffer
      .map(item => item.text)
      .join(' ');
  }

  // YENİ: Akıllı tetikleme - birden fazla koşul
  shouldTriggerAnalysis() {
    const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime;
    const timeSinceLastTranscript = Date.now() - this.lastTranscriptTime;
    
    return (
      // Koşul 1: Minimum süre geçti VE yeni transkript var
      (timeSinceLastAnalysis > this.minAnalysisInterval && 
       this.transcriptsSinceLastAnalysis > 0) ||
      
      // Koşul 2: Belirli sayıda transkript birikti
      this.transcriptsSinceLastAnalysis >= this.transcriptThreshold ||
      
      // Koşul 3: Konuşma durdu (2 saniye sessizlik)
      timeSinceLastTranscript > 2000
    );
  }

  // OpenAI Realtime API'ye bağlan
  async connectToRealtime() {
    try {
      console.log('🔌 Connecting to OpenAI Realtime API...');
      
      // OpenAI client'ı başlat
      const openaiClient = initializeOpenAI(process.env.OPENAI_API_KEY);
      
      // WebSocket bağlantısı kur (dokümantasyona göre)
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-realtime`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
        }
      );

      this.realtimeWs = ws;

      ws.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');
        
        // Session update gönder (dokümantasyona göre)
        ws.send(JSON.stringify({
          type: 'session.update',
          session: {
            type: 'realtime',
            model: 'gpt-realtime',
            instructions: 'You are a helpful assistant for real-time speech transcription and translation.',
            audio: {
              input: {
                format: {
                  type: 'audio/pcm',
                  rate: this.sampleRate, // Dinamik sample rate
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 500,
                },
                transcription: {
                  model: 'gpt-4o-transcribe',
                  prompt: '',
                  language: this.currentLanguage, // Use session language
                },
              },
              output: {
                format: {
                  type: 'audio/pcm',
                  rate: this.sampleRate, // Dinamik sample rate
                },
                voice: 'alloy',
              },
            },
          },
        }));
        
        this.ws.send(JSON.stringify({
          type: 'status',
          message: 'Connected to transcription service',
        }));
      });

      ws.on('message', async (data) => {
        const event = JSON.parse(data.toString());
        await this.handleRealtimeEvent(event);
      });

      ws.on('error', (error) => {
        console.error('❌ Realtime API error:', error);
        this.ws.send(JSON.stringify({
          type: 'error',
          message: 'Transcription service error',
        }));
      });

      ws.on('close', () => {
        console.log('🔌 Disconnected from OpenAI Realtime API');
      });

    } catch (error) {
      console.error('❌ Failed to connect to Realtime API:', error);
    }
  }

  // Realtime API eventlerini işle
  async handleRealtimeEvent(event) {
    switch (event.type) {
      case 'session.created':
        console.log('✅ Realtime session created');
        break;
        
      case 'session.updated':
        console.log('✅ Realtime session updated');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const transcript = event.transcript;
        const timestamp = Date.now();
        const chunkId = `chunk-${Date.now()}-${this.chunkCounter++}`; // 🆕 ADIM 1.0a: Benzersiz ID
        
        console.log('📝 Transcript:', transcript, '| ID:', chunkId); // 🆕 ID de logla
        
        // 🆕 ADIM 1.0a: Chunks map'e ekle
        this.chunksMap.set(chunkId, {
          id: chunkId,
          text: transcript,
          timestamp,
          corrected: false,
          translationSent: false
        });
        
        // Context buffer'a ekle (şimdi ID ile)
        this.addToContext(transcript, timestamp, chunkId); // 🆕 chunkId parametresi eklendi
        
        // Client'a gönder (ID ile)
        this.ws.send(JSON.stringify({
          type: 'transcript',
          data: {
            id: chunkId, // 🆕 YENİ: ID eklendi
            text: transcript,
            timestamp,
            corrected: false,
          },
        }));
        
        // 🔧 FIX: Her chunk için tetikle (shouldTriggerAnalysis kontrolü kaldırıldı)
        // Paralel çalıştır: düzeltme ve çeviriyi aynı anda başlat
        Promise.all([
          this.analyzeAndCorrect(),
          this.autoTranslate(chunkId) // Her chunk için çeviri
        ]).catch(err => console.error('Analysis error:', err));
        
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.error('❌ Transcription failed:', event.error);
        break;
        
      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech started');
        break;
        
      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 Speech stopped');
        break;
        
      case 'input_audio_buffer.committed':
        console.log('✅ Audio buffer committed');
        break;
        
      case 'error':
        console.error('❌ Realtime API error:', event.error);
        this.ws.send(JSON.stringify({
          type: 'error',
          message: event.error?.message || 'Unknown error',
        }));
        break;
    }
  }

  // 🆕 ADIM 2.1: Dinamik prompt builder
  async buildDynamicPrompt(context) {
    try {
      // 🆕 ADIM 2.2: Keyword cache kontrolü (performans)
      const cacheKey = context.slice(-100); // Son 100 karakter key olarak
      const cached = this.keywordCache.get(cacheKey);
      
      let keywords;
      if (cached && Date.now() - cached.timestamp < this.KEYWORD_CACHE_TTL) {
        keywords = cached.keywords;
        console.log('✅ Using cached keywords:', keywords);
      } else {
        // ADIM 1: GPT ile keyword extraction (bağlamsal analiz için)
        // 🔧 FIX: Session'daki API key kullan (this.apiKey)
        const keywordResponse = await initializeOpenAI(this.apiKey || process.env.OPENAI_API_KEY).chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{
            role: 'user',
            content: `Extract 3-5 key topics, entities, or context clues from this transcript. 
Ignore filler words. Focus on what the user is talking about.
Return comma-separated list:

"${context}"

Key topics:`
          }],
          max_tokens: 30,
          temperature: 0.3
        });
        
        keywords = keywordResponse.choices[0].message.content.trim();
        
        // Cache'e ekle
        this.keywordCache.set(cacheKey, {
          keywords,
          timestamp: Date.now()
        });
        
        console.log('🔑 Extracted keywords:', keywords);
      }
      
      // ADIM 2: Bağlamsal prompt oluştur
      return `Analyze this speech transcript for transcription errors.

Context clues (what user is talking about): ${keywords}

Text: "${context}"

Consider:
1. Homophones based on context (e.g., "resim" vs "sesim" in mic test)
2. Entity names that match the context
3. Technical terms related to: ${keywords}

Return JSON:
{
  "topic": "${keywords}",
  "corrections": [{"original": "X", "corrected": "Y", "confidence": 0.9}]
}`;

    } catch (error) {
      console.error('❌ Keyword extraction failed:', error);
      // Fallback: basit prompt
      return `Analyze this speech transcript for entity errors.

Text: "${context}"

Return JSON:
{
  "topic": "general",
  "corrections": [{"original": "X", "corrected": "Y", "confidence": 0.9}]
}`;
    }
  }

  // YENİ: Cache'li düzeltme
  async analyzeAndCorrect() {
    // 🔧 FIX: Minimum context kontrolü kaldırıldı - ilk cümleden itibaren düzelt
    if (this.currentContext.length < 5) return; // Sadece çok kısa metinleri atla

    try {
      // Cache kontrolü - son 20 kelimeyi key olarak kullan
      const contextKey = this.currentContext.split(' ').slice(-20).join(' ');
      const cached = this.correctionCache.get(contextKey);
      
      if (cached && Date.now() - cached.timestamp < 30000) {
        console.log('✅ Using cached corrections');
        this.sendCorrections(cached.data);
        return;
      }

      console.log('🔍 Analyzing context...');
      
      // 🆕 ADIM 2.4: Performans optimizasyonu
      const recentContext = this.currentContext.slice(-200);
      
      // Background'da keyword extraction (bekleme yok!)
      this.buildDynamicPrompt(recentContext).catch(err => 
        console.error('❌ Keyword extraction background error:', err)
      );
      
      // Hızlı prompt kullan (keyword extraction beklemeden)
      const quickPrompt = `Analyze this speech transcript for transcription errors.

Text: "${recentContext}"

Common errors:
- Homophones (hear/here, see/sea)
- Entity names
- Technical terms

Return JSON:
{
  "topic": "detected topic",
  "corrections": [{"original": "X", "corrected": "Y", "confidence": 0.9}]
}`;
      
      // 🔧 FIX: Session'daki API key kullan (this.apiKey)
      const response = await initializeOpenAI(this.apiKey || process.env.OPENAI_API_KEY).chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at correcting speech transcription errors. Respond with JSON only.',
          },
          {
            role: 'user',
            content: quickPrompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      // 🔧 FIX: JSON parse güvenli hale getirildi
      const content = response.choices[0]?.message?.content;
      
      if (!content || content.trim() === '') {
        console.log('⚠️ GPT returned empty response, skipping correction');
        return;
      }
      
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        console.error('❌ JSON parse failed:', parseError.message);
        console.error('📄 GPT response:', content);
        return;
      }
      
      if (result.corrections && result.corrections.length > 0) {
        console.log('✅ Found corrections:', result.corrections);
        
        // Cache'e ekle
        this.correctionCache.set(contextKey, {
          data: result,
          timestamp: Date.now()
        });
        
        this.sendCorrections(result);
      }

    } catch (error) {
      console.error('❌ Correction failed:', error);
    }
  }

  sendCorrections(result) {
    this.ws.send(JSON.stringify({
      type: 'corrections',
      data: {
        topic: result.topic,
        corrections: result.corrections,
      },
    }));
    
    // 🆕 ADIM 1.0d: Düzeltme sonrası yeniden çeviri
    if (result.corrections && result.corrections.length > 0) {
      this.retranslateAffectedChunks(result.corrections);
    }
  }
  
  // 🆕 ADIM 1.0d: Etkilenen chunk'ları yeniden çevir
  async retranslateAffectedChunks(corrections) {
    if (!this.targetLanguage || this.targetLanguage === 'Original') return;
    
    // Her düzeltme için etkilenen chunk'ları bul
    corrections.forEach(async (correction) => {
      // chunksMap'te düzeltilen kelimeyi içeren chunk'ları bul
      for (const [chunkId, chunk] of this.chunksMap.entries()) {
        if (chunk.text.includes(correction.original)) {
          console.log(`🔄 Retranslating chunk ${chunkId}: "${correction.original}" → "${correction.corrected}"`);
          
          // Düzeltilmiş metni oluştur
          const correctedText = chunk.text.replace(
            new RegExp(correction.original, 'gi'),
            correction.corrected
          );
          
          // Chunk'ı güncelle
          chunk.corrected = correctedText;
          
          // Yeniden çevir
          await this.translate(correctedText, this.targetLanguage, chunkId);
        }
      }
    });
  }

  // YENİ: Otomatik çeviri - HER CHUNK için tetiklenir
  async autoTranslate(chunkId) { // 🆕 ADIM 1.0c: chunkId parametresi eklendi
    // 🔧 FIX: Sadece bu chunk'ı çevir (cumulative değil!)
    const chunk = this.chunksMap.get(chunkId);
    if (!chunk) return;
    
    const textToTranslate = chunk.text;
    if (textToTranslate.length < 5) return; // Çok kısa metinleri atla
    
    // Chunk'ı işaretle (çeviri gönderildi)
    chunk.translationSent = true;
    
    // Çeviriyi başlat (sadece bu chunk'ın metni)
    if (this.targetLanguage && this.targetLanguage !== 'Original') {
      await this.translate(textToTranslate, this.targetLanguage, chunkId);
    }
  }

  // Audio data gönder
  sendAudio(audioData) {
    if (this.realtimeWs && this.realtimeWs.readyState === WebSocket.OPEN) {
      this.realtimeWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioData,
      }));
    }
  }

  async translate(text, targetLanguage, chunkId) { // 🆕 ADIM 1.0c: chunkId parametresi eklendi
    try {
      // 🔧 ADIM 2.4.2: Kısa prompt + düşük token
      const stream = await initializeOpenAI(process.env.OPENAI_API_KEY).chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `Translate to ${targetLanguage}. Keep names as-is.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 150, // 🔧 300→150 (chunk'lar küçük)
        temperature: 0.3, // 🔧 Consistency için
        stream: true,
      });

      // Stream başladı işareti (🆕 for_chunk_id eklendi)
      this.ws.send(JSON.stringify({
        type: 'translation_start',
        data: { 
          language: targetLanguage,
          for_chunk_id: chunkId // 🆕 ADIM 1.0c: Hangi chunk için
        }
      }));

      // 🔧 ADIM 2.4.3: Batching ile streaming optimize et
      let buffer = '';
      let lastSendTime = Date.now();
      const BATCH_INTERVAL = 50; // 50ms batching (UI için daha akıcı)
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          buffer += content;
          
          // 50ms'de bir veya buffer dolunca gönder
          const now = Date.now();
          if (now - lastSendTime >= BATCH_INTERVAL || buffer.length > 50) {
            this.ws.send(JSON.stringify({
              type: 'translation',
              data: {
                text: buffer,
                language: targetLanguage,
                partial: true,
                for_chunk_id: chunkId // 🆕 ADIM 1.0c
              },
            }));
            buffer = '';
            lastSendTime = now;
          }
        }
      }
      
      // Kalan buffer'ı gönder
      if (buffer) {
        this.ws.send(JSON.stringify({
          type: 'translation',
          data: {
            text: buffer,
            language: targetLanguage,
            partial: true,
            for_chunk_id: chunkId
          },
        }));
      }

      // Translation complete (🆕 for_chunk_id eklendi)
      this.ws.send(JSON.stringify({
        type: 'translation',
        data: {
          language: targetLanguage,
          partial: false,
          for_chunk_id: chunkId // 🆕 ADIM 1.0c
        },
      }));

    } catch (error) {
      console.error('❌ Translation failed:', error);
    }
  }

  disconnect() {
    // 🆕 ADIM 1.4: Cleanup timer'ı durdur
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      console.log('🛑 Cleanup timer stopped');
    }
    
    if (this.realtimeWs) {
      this.realtimeWs.close();
    }
  }
}

// HTTP Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// WebSocket Server
const wss = new WebSocketServer({ 
  server,
  perMessageDeflate: false, // Düşük latency için
  maxPayload: 16 * 1024 * 1024, // 16MB max payload
});

wss.on('connection', (ws, req) => {
  console.log('👤 New client connected from:', req.socket.remoteAddress);
  
  const sessionId = Math.random().toString(36).substring(7);
  const session = new TranscriptionSession(ws);
  sessions.set(sessionId, session);
  
  // Bağlantı onayı gönder
  ws.send(JSON.stringify({
    type: 'status',
    message: 'Connected successfully'
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'start':
          console.log('▶️  Starting transcription session');
          if (data.apiKey) {
            // Frontend'den gelen API key'i kullan
            process.env.OPENAI_API_KEY = data.apiKey;
            console.log('🔑 Using API key from frontend');
            // OpenAI client'ı yeniden başlat
            openai = null;
            initializeOpenAI(data.apiKey);
          } else if (!process.env.OPENAI_API_KEY) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'API key required'
            }));
            return;
          }
          
          // Dil bilgisini session'a kaydet
          if (data.language) {
            // ISO 639-1 dil kodlarını doğrula
            const supportedLanguages = [
              'af', 'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gl', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'iw', 'ja', 'kk', 'kn', 'ko', 'lt', 'lv', 'mi', 'mk', 'mr', 'ms', 'ne', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'th', 'tl', 'tr', 'uk', 'ur', 'vi', 'zh'
            ];
            
            const languageCode = supportedLanguages.includes(data.language) ? data.language : 'en';
            
            if (languageCode !== data.language) {
              console.warn(`⚠️ Unsupported language '${data.language}', falling back to 'en'`);
            }
            
            session.currentLanguage = languageCode;
            console.log('🌐 Language set to:', languageCode);
          }
          
          // YENİ: Hedef çeviri dilini session'a kaydet
          if (data.targetLanguage) {
            session.targetLanguage = data.targetLanguage;
            console.log('🎯 Target language set to:', data.targetLanguage);
          }
          
          // Sample rate bilgisini session'a kaydet
          if (data.sampleRate) {
            // Desteklenen sample rate'leri kontrol et
            const supportedRates = [16000, 24000, 44100, 48000];
            const sampleRate = supportedRates.includes(data.sampleRate) ? data.sampleRate : 24000;
            
            if (sampleRate !== data.sampleRate) {
              console.warn(`⚠️ Unsupported sample rate '${data.sampleRate}', falling back to '24000'`);
            }
            
            session.sampleRate = sampleRate;
            console.log('🎵 Sample rate set to:', sampleRate);
          }
          
          await session.connectToRealtime();
          break;

        case 'audio':
          // Audio data from client (base64 PCM)
          session.sendAudio(data.audio);
          break;

        case 'translate':
          // Translation request
          await session.translate(data.text, data.targetLanguage);
          break;

        case 'update_language':
          console.log('🌐 Updating language to:', data.language);
          
          // ISO 639-1 dil kodlarını doğrula
          const supportedLanguages = [
            'af', 'ar', 'az', 'be', 'bg', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'el', 'en', 'es', 'et', 'fa', 'fi', 'fr', 'gl', 'he', 'hi', 'hr', 'hu', 'hy', 'id', 'is', 'it', 'iw', 'ja', 'kk', 'kn', 'ko', 'lt', 'lv', 'mi', 'mk', 'mr', 'ms', 'ne', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv', 'sw', 'ta', 'th', 'tl', 'tr', 'uk', 'ur', 'vi', 'zh'
          ];
          
          const languageCode = supportedLanguages.includes(data.language) ? data.language : 'en';
          
          if (languageCode !== data.language) {
            console.warn(`⚠️ Unsupported language '${data.language}', falling back to 'en'`);
          }
          
          // Session'ın dilini güncelle
          session.currentLanguage = languageCode;
          
          if (session.realtimeWs && session.realtimeWs.readyState === WebSocket.OPEN) {
            session.realtimeWs.send(JSON.stringify({
              type: 'session.update',
              session: {
                audio: {
                  input: {
                    transcription: {
                      language: languageCode,
                    },
                  },
                },
              },
            }));
          }
          break;

        case 'update_target_language':
          console.log('🎯 Updating target language to:', data.targetLanguage);
          session.targetLanguage = data.targetLanguage;
          break;

        case 'stop':
          console.log('⏹️  Stopping transcription session');
          session.disconnect();
          break;
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
      
      // Sadece açık bağlantılara hata gönder
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    }
  });

  ws.on('close', (code, reason) => {
    console.log('👋 Client disconnected:', code, reason.toString());
    session.disconnect();
    sessions.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
    session.disconnect();
    sessions.delete(sessionId);
  });
  
  // Ping-pong ile bağlantıyı canlı tut
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(pingInterval);
    }
  }, 30000); // 30 saniyede bir ping
  
  ws.on('pong', () => {
    // Pong geldi, bağlantı canlı
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    uptime: process.uptime(),
  });
});

console.log('🎙️  Real-time Translation Server Ready!');
console.log('📡 WebSocket endpoint: ws://localhost:' + PORT);
