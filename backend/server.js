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
  }

  // Rolling context window (60 saniye)
  addToContext(text, timestamp) {
    this.contextBuffer.push({ text, timestamp });
    
    // 60 saniyeden eski kayıtları temizle
    const cutoffTime = Date.now() - 60000;
    this.contextBuffer = this.contextBuffer.filter(
      item => item.timestamp > cutoffTime
    );
    
    this.currentContext = this.contextBuffer
      .map(item => item.text)
      .join(' ');
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
        
        console.log('📝 Transcript:', transcript);
        
        // Context buffer'a ekle
        this.addToContext(transcript, timestamp);
        
        // Client'a gönder (ham transcript)
        this.ws.send(JSON.stringify({
          type: 'transcript',
          data: {
            text: transcript,
            timestamp,
            corrected: false,
          },
        }));
        
        // Her 5 saniyede bir context analizi yap
        if (Date.now() - this.lastAnalysisTime > 5000) {
          this.lastAnalysisTime = Date.now();
          await this.analyzeAndCorrect();
        }
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

  // Context-aware correction engine
  async analyzeAndCorrect() {
    if (this.currentContext.length < 50) return; // Minimum context gerekli

    try {
      console.log('🔍 Analyzing context for corrections...');
      
      const prompt = `Analyze this real-time speech transcript and find entity recognition errors.

Transcript: "${this.currentContext}"

Common error patterns:
- Homophones: "NBC" → "NBA" (basketball), "MVW" → "MVP" (awards)
- Name corrections: "Lebron Harden" → "LeBron James"
- Organization names based on context
- Scientific terms: "RNA" vs "NBA" based on topic

Detect the current conversation topic (sports, science, tech, etc.) and correct accordingly.

Return ONLY valid JSON in this exact format:
{
  "topic": "detected topic",
  "corrections": [
    {
      "original": "wrong text",
      "corrected": "right text",
      "position": "approximate word position",
      "confidence": 0.95,
      "reason": "brief explanation"
    }
  ]
}

If no corrections needed, return: {"topic": "detected topic", "corrections": []}`;

      const response = await initializeOpenAI(process.env.OPENAI_API_KEY).chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at detecting and correcting named entity recognition errors in speech transcripts. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      if (result.corrections && result.corrections.length > 0) {
        console.log('✅ Found corrections:', result.corrections);
        
        // Client'a düzeltmeleri gönder
        this.ws.send(JSON.stringify({
          type: 'corrections',
          data: {
            topic: result.topic,
            corrections: result.corrections,
          },
        }));
      }

    } catch (error) {
      console.error('❌ Correction analysis failed:', error);
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

  // Çeviri yap
  async translate(text, targetLanguage) {
    try {
      const stream = await initializeOpenAI(process.env.OPENAI_API_KEY).chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate to ${targetLanguage}.
Rules:
- Preserve named entities (names, brands, organizations)
- Maintain the tone and style
- Use the context provided
Context: ${this.currentContext.slice(-500)}`, // Son 500 karakter
          },
          {
            role: 'user',
            content: text,
          },
        ],
        stream: true,
      });

      // Stream translation to client
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          this.ws.send(JSON.stringify({
            type: 'translation',
            data: {
              text: content,
              language: targetLanguage,
              partial: true,
            },
          }));
        }
      }

      // Translation complete
      this.ws.send(JSON.stringify({
        type: 'translation',
        data: {
          language: targetLanguage,
          partial: false,
        },
      }));

    } catch (error) {
      console.error('❌ Translation failed:', error);
    }
  }

  disconnect() {
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
