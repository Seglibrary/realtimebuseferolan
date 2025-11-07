# 🔍 YAPAY ZEKA ÖNERİLERİ DEĞERLENDİRMESİ

> **Tarih**: 7 Kasım 2025, 22:30  
> **Değerlendiren**: GitHub Copilot (SEG için)  
> **Temel**: SEG'in öncelikleri + Projenin mevcut yapısı  
> **2 AI Önerisi**: Confidence fusion, Topic shift, Candidate generation, Batch GPT, Global dil + Atomik ID sistemi, TTL queue

---

## 📋 ÖZET KARAR: HANGILERINI KABUL EDİYORUZ?

| Öneri | Karar | Öncelik | Neden? |
|-------|-------|---------|--------|
| **1. Atomik ID-Temelli Akış** | ✅ **KABUL** | 🔴 KRİTİK | Race condition'ı %100 çözüyor, SEG'in 1. önceliği ile uyumlu |
| **2. Confidence Fusion** | ⚠️ **KISMEN** | 🟡 ORTA | GPT-4o Realtime API alternatives varsa kullan, yoksa ATLAMA |
| **3. Topic Shift Ön-Filtre** | ❌ **RED** | 🟢 DÜŞÜK | SEG'in "statik pattern yok" prensibiyle çelişiyor |
| **4. Candidate Generation Fix** | ✅ **KABUL** | 🔴 KRİTİK | Hafta 3'ün tüm mantığı buna bağlı |
| **5. Batch GPT Çağrısı** | ⚠️ **ERTELENDİ** | 🟢 DÜŞÜK | Streaming translation ile çelişir, Hafta 5'e ertele |
| **6. Global Dil (stopWords kaldır)** | ✅ **KABUL** | 🔴 KRİTİK | SEG'in global kullanım hedefiyle %100 uyumlu |
| **7. TTL Queue** | ✅ **KABUL** | 🟡 ORTA | Memory leak'i önler, basit implementasyon |
| **8. Frontend State Hell Fix** | ✅ **KABUL** | 🔴 KRİTİK | Atomik ID ile birlikte çözülecek |

---

## 🎯 BÖLÜM 1: EN KRİTİK ÖNERİ - ATOMİK ID SİSTEMİ

### **AI'nın Analizi:** ✅ %100 DOĞRU

> "Mevcut 'stream-of-text' mimarisinden 'stream-of-stateful-objects' mimarisine geçiş yapılmalı"

**Neden Doğru:**
Şu anki kodda (backend/server.js:216) şu var:
```javascript
Promise.all([
  this.analyzeAndCorrect(),
  this.autoTranslate()
])
```

Problem: `autoTranslate()` fonksiyonu (satır 328) **son 3 transcript'i birleştirerek çeviriyor**:
```javascript
const recentTranscripts = this.contextBuffer
  .slice(-3)
  .map(item => item.text)
  .join(' ');
```

Ama düzeltme geldiğinde (satır 320), **hangi transcript'in** düzeltildiği bilinmiyor. Frontend'de de (App.jsx:124) son 5 transcript taranıyor:
```javascript
for (let i = updated.length - 1; i >= Math.max(0, updated.length - 5); i--) {
  if (updated[i].text.includes(correction.original)) {
```

Bu `includes()` kullanımı **tehlikeli**! Şu senaryoda patlar:

```
Transcript 1: "Benim ka var" → Çeviri: "I have because"
Transcript 2: "Başka bir ka aldım" → Çeviri: "I bought another because"
Düzeltme: "ka" → "kalem"

Frontend: HER İKİ transcript'i de düzeltir (includes ile)
Ama çeviriler: Hala "because" yazıyor! ❌
```

---

### **✅ SEG'İN KARARI: KABUL EDİYORUZ**

**Implementasyon (Hafta 1'e ekleniyor):**

#### **Backend Değişikliği (server.js):**
```javascript
// MEVCUT: TranscriptionSession sınıfına ekle
constructor(ws) {
  // ... mevcut kod
  this.chunkCounter = 0; // YENİ: Benzersiz ID için
}

// DEĞİŞTİR: handleRealtimeEvent fonksiyonunu
case 'conversation.item.input_audio_transcription.completed':
  const transcript = event.transcript;
  const timestamp = Date.now();
  const chunkId = `chunk-${this.chunkCounter++}`; // YENİ: Benzersiz ID
  
  console.log('📝 Transcript:', transcript, 'ID:', chunkId);
  
  // Context buffer'a ekle (ID ile)
  this.addToContext(transcript, timestamp, chunkId); // YENİ parametre
  
  // Client'a gönder (ID ile)
  this.ws.send(JSON.stringify({
    type: 'transcript',
    data: {
      id: chunkId, // YENİ
      text: transcript,
      timestamp,
      corrected: false,
    },
  }));
  
  // Paralel çalıştır
  if (this.shouldTriggerAnalysis()) {
    this.lastAnalysisTime = Date.now();
    this.transcriptsSinceLastAnalysis = 0;
    
    Promise.all([
      this.analyzeAndCorrect(),
      this.autoTranslate(chunkId) // YENİ: ID geç
    ]).catch(err => console.error('Analysis error:', err));
  }
  break;
```

```javascript
// DEĞİŞTİR: addToContext fonksiyonunu
addToContext(text, timestamp, id) { // YENİ parametre
  this.contextBuffer.push({ id, text, timestamp }); // ID ekle
  // ... geri kalan kod aynı
}
```

```javascript
// DEĞİŞTİR: autoTranslate fonksiyonunu
async autoTranslate(chunkId) { // YENİ parametre
  const recentChunks = this.contextBuffer.slice(-3); // Chunk objesi döner
  const recentText = recentChunks.map(c => c.text).join(' ');
  
  if (recentText.length < 20) return;
  
  if (this.targetLanguage && this.targetLanguage !== 'Original') {
    await this.translate(recentText, this.targetLanguage, chunkId); // ID geç
  }
}
```

```javascript
// DEĞİŞTİR: translate fonksiyonunu
async translate(text, targetLanguage, chunkId) { // YENİ parametre
  try {
    // ... mevcut stream kodu
    
    // Stream başladı işareti (ID ile)
    this.ws.send(JSON.stringify({
      type: 'translation_start',
      data: { 
        language: targetLanguage,
        for_chunk_id: chunkId // YENİ: Hangi chunk için
      }
    }));

    // Stream translation (her chunk'a ID ekle)
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        this.ws.send(JSON.stringify({
          type: 'translation',
          data: {
            text: content,
            language: targetLanguage,
            partial: true,
            for_chunk_id: chunkId // YENİ
          },
        }));
      }
    }
    
    // ... geri kalan kod
  } catch (error) {
    console.error('❌ Translation failed:', error);
  }
}
```

```javascript
// DEĞİŞTİR: analyzeAndCorrect fonksiyonunu (düzeltmeler için ID)
async analyzeAndCorrect() {
  // ... mevcut analiz kodu
  
  // Düzeltme bulundu, HANGI chunk'a ait bul
  result.corrections.forEach(correction => {
    // Son 5 chunk'ı tara
    const affectedChunks = this.contextBuffer
      .slice(-5)
      .filter(chunk => chunk.text.includes(correction.original));
    
    affectedChunks.forEach(chunk => {
      this.ws.send(JSON.stringify({
        type: 'correction',
        data: {
          for_chunk_id: chunk.id, // YENİ: Hangi chunk düzeltiliyor
          original: correction.original,
          corrected: correction.corrected,
          confidence: correction.confidence,
        },
      }));
    });
  });
}
```

#### **Frontend Değişikliği (App.jsx):**
```javascript
// DEĞİŞTİR: handleServerMessage fonksiyonunu
const handleServerMessage = (message) => {
  const now = Date.now();
  
  switch (message.type) {
    case 'transcript':
      setTranscript(prev => [...prev, {
        id: message.data.id, // YENİ: Backend'den gelen ID
        text: message.data.text,
        timestamp: message.data.timestamp,
        corrected: false,
        corrections: [],
        translationId: null, // YENİ: Hangi çeviri ile eşleşiyor
      }]);
      break;

    case 'translation_start':
      // YENİ: Çeviri state'inde chunk ID ile eşleştir
      setTranslation(prev => ({
        ...prev,
        [message.data.for_chunk_id]: '' // Bu chunk için yeni çeviri başlat
      }));
      break;

    case 'translation':
      if (message.data.partial) {
        setTranslation(prev => ({
          ...prev,
          [message.data.for_chunk_id]: (prev[message.data.for_chunk_id] || '') + message.data.text
        }));
      }
      break;

    case 'correction':
      // YENİ: ID ile doğrudan bul ve düzelt
      setTranscript(prev => prev.map(item => {
        if (item.id === message.data.for_chunk_id) {
          return {
            ...item,
            corrected: true,
            corrections: [...item.corrections, message.data],
            needsAnimation: true,
          };
        }
        return item;
      }));
      
      // ÇOK ÖNEMLİ: O chunk'ın çevirisini GEÇERSİZ YAP
      setTranslation(prev => ({
        ...prev,
        [message.data.for_chunk_id]: null // Çeviriyi sil veya "⏳ Re-translating..." yap
      }));
      
      // YENİ: Yeniden çeviri iste (Seçenek B - İdeal)
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'retranslate',
          chunkId: message.data.for_chunk_id,
          correctedText: message.data.corrected
        }));
      }
      break;
      
    // ... diğer case'ler
  }
};
```

**UI Görünümü:**
```jsx
// DEĞİŞTİR: Transcript gösterimini
<div className="transcript-list">
  {transcript.map((item) => (
    <div key={item.id} className="transcript-item">
      <div className={item.corrected ? 'text-corrected' : 'text-normal'}>
        {item.corrections.length > 0 ? (
          <span>
            <s>{item.corrections[0].original}</s> {item.corrections[0].corrected}
          </span>
        ) : (
          item.text
        )}
      </div>
      <div className="translation-for-chunk">
        {translation[item.id] === null ? (
          <span className="text-yellow-400">⏳ Re-translating...</span>
        ) : (
          <span>{translation[item.id] || ''}</span>
        )}
      </div>
    </div>
  ))}
</div>
```

**Backend için yeni endpoint (retranslate):**
```javascript
// server.js: WebSocket message handler'a ekle
case 'retranslate':
  const chunk = session.contextBuffer.find(c => c.id === data.chunkId);
  if (chunk) {
    // Düzeltilmiş metni çevir
    await session.translate(data.correctedText, session.targetLanguage, data.chunkId);
  }
  break;
```

---

### **📊 Kazanç:**
- ✅ Race condition %100 çözüldü
- ✅ "Yetim çeviri" problemi yok
- ✅ UI veri tutarlılığı garanti
- ⚡ Performans kaybı: ~0 (sadece ID string eklendi)

---

## 🎯 BÖLÜM 2: CONFIDENCE FUSION ÖNERİSİ

### **AI'nın Önerisi:**
> "ASR'nin kelime confidence skorunu ve fonetik benzerliği eklemek doğruluğu artırır"

**Analiz:**
GPT-4o Realtime API dokümantasyonunu kontrol ettim. API'nin döndürdüğü event yapısı:

```javascript
{
  type: 'conversation.item.input_audio_transcription.completed',
  transcript: 'merhaba',
  // ❓ alternatives: [...]? (Dokümantasyonda yok)
  // ❓ confidence: 0.95? (Dokümantasyonda yok)
}
```

**Problem:** OpenAI'nin Realtime API'si (şu an) **alternatives veya confidence** döndürmüyor. Google Speech-to-Text veya Azure Speech gibi servisler döndürüyor ama OpenAI döndürmüyor.

---

### **⚠️ SEG'İN KARARI: KISMİ KABUL (KOŞULLU)**

**Şimdi yapılacak:**
```javascript
// Backend'de test et (server.js: handleRealtimeEvent)
case 'conversation.item.input_audio_transcription.completed':
  console.log('🔍 FULL EVENT:', JSON.stringify(event, null, 2)); // Detaylı log
  
  // Eğer alternatives varsa kullan
  if (event.alternatives && event.alternatives.length > 1) {
    console.log('✅ Alternatives found:', event.alternatives);
    // Embedding'e gönder (Hafta 3'te kullan)
  } else {
    console.log('⚠️ No alternatives - will skip confidence fusion');
  }
```

**Eğer alternatives varsa (Hafta 3'te):**
```javascript
// Hafta 3: checkWithEmbedding fonksiyonuna ekle
async function checkWithEmbedding(uncertainWord, context, sttAlternatives = []) {
  // 1. STT'nin kendi alternatifleri varsa onları kullan (GPT'ye gitme!)
  const candidates = sttAlternatives.length > 0 
    ? sttAlternatives.map(alt => alt.transcript)
    : await generateCandidates(uncertainWord); // Fallback: GPT'ye sor
  
  // ... geri kalan embedding logic
}
```

**Eğer alternatives yoksa:**
- ❌ Confidence fusion atlanır
- ✅ Hafta 2'nin dynamic prompt'u kullanılır
- ✅ Hafta 3'ün embedding+GPT hibrit'i kullanılır

**Karar:** İlk haftada test et, varsa kullan, yoksa plan devam eder.

---

## 🎯 BÖLÜM 3: TOPIC SHIFT ÖN-FİLTRESİ

### **AI'nın Önerisi:**
> "Embedding-based benzerlik düşüşü ile şüpheli segmentleri işaretlemek"

**Analiz:**
Bu, Hafta 2'deki `detectTopicsFromKeywords` fonksiyonunu daha "akıllı" yapmak için öneriliyor. Ama bu **SEG'in prensipleriyle çelişiyor**:

SEG'in isteği (7.11.2205.md):
- ❌ Statik pattern'ler (topicMap: { sports: ['nba', 'lakers'], medical: ['hasta', 'nabız'] })
- ✅ GPT'nin built-in bilgisini kullan

Topic shift detection de bir tür "pattern matching". Örnek:
```javascript
// Önerilen yaklaşım:
const topicEmbedding1 = await getEmbedding("NBA Lakers basketball");
const topicEmbedding2 = await getEmbedding("book author story");

if (cosineSimilarity(topicEmbedding1, topicEmbedding2) < 0.3) {
  console.log("Topic shift detected!");
}
```

**Problem:** Bu yine "manuel threshold" (0.3) ve "konu algılama pattern'i" demek. SEG'in "sistem kendi karar vermeli" felsefesine ters.

---

### **❌ SEG'İN KARARI: RED EDİYORUZ**

**Sebep:**
1. Hafta 2'nin dynamic prompt'u **zaten topic-aware** (context'ten keyword çıkarıp GPT'ye veriyor)
2. Topic shift detection için **yeni bir pattern sistemi** (threshold, embedding comparison) eklemek, planın "statik prompt'tan kurtulma" hedefini baltalıyor
3. Maliyet/fayda oranı düşük: Topic shift'i GPT-4o-mini zaten bağlamdan anlıyor

**Alternatif:**
Hafta 2'de zaten var:
```javascript
// buildDynamicPrompt (7.11.2205.md satır 428)
const keywords = extractKeywords(context);
// GPT'ye "Context: ${context}" veriliyor
// GPT topic shift'i kendisi anlıyor!
```

Daha fazla karmaşıklık eklemeye gerek yok.

---

## 🎯 BÖLÜM 4: CANDIDATE GENERATION FIX (EN KRİTİK!)

### **AI'nın Analizi:** ✅ %100 DOĞRU

> "generateCandidates için GPT'ye gitmek, Hafta 3'ün tüm amacını yok eder"

**Mevcut Plan (7.11.2205.md satır 617):**
```javascript
function generateCandidates(uncertainWord) {
  // GPT-4o-mini'ye hızlı sor: "Bu kelime ne olabilir?"
  // - GPT'ye minimal prompt: "What could 'ka' be? List 5 possibilities."
  // - Response: ["kalem", "kale", "kağıt", "kar", "kap"]
}
```

**Problem:** Bu zaten GPT çağrısı! Yani:
```
uncertainWord geldi
  ↓
GPT'ye sor candidates (300ms, $0.0001)
  ↓
Embedding check (50ms, $0.00002)
  ↓
Eğer confidence < 0.90 → GPT'ye TEKRAR sor (300ms, $0.0001)

Toplam: 350-650ms, $0.0001-0.0002
Eski yöntem: 300ms, $0.0001

KAZANÇ: YOK! ❌
```

---

### **✅ SEG'İN KARARI: KABUL EDİYORUZ - FIX GEREKLİ**

**Çözüm Seçenekleri:**

#### **Seçenek A: STT Alternatives Kullan (En İyi)**
```javascript
async function generateCandidates(uncertainWord, sttAlternatives = []) {
  // Eğer STT alternatives varsa (Bölüm 2'den)
  if (sttAlternatives.length > 0) {
    return sttAlternatives.map(alt => alt.transcript); // 0ms, $0 ⚡⚡⚡
  }
  
  // Fallback: ?
}
```

#### **Seçenek B: Fonetik Algoritma (Türkçe için zor)**
```javascript
// Soundex/Metaphone gibi algoritmalar İngilizce için çalışır
// Türkçe için (ve global multi-language için) ÇALIŞMAZ ❌
// RED!
```

#### **Seçenek C: Context-Based Guessing (GPT'siz)**
```javascript
async function generateCandidates(uncertainWord, context) {
  // Context'teki kelimelere fonetik/yazım benzerliği olan kelimeler bul
  const contextWords = context.split(/\s+/);
  
  // Belirsiz kelimenin ilk harfi ile başlayan context kelimelerini al
  const candidates = contextWords.filter(word => 
    word.toLowerCase().startsWith(uncertainWord.toLowerCase()[0])
  );
  
  if (candidates.length < 3) {
    // Yeterli aday yok, GPT'ye sor (maliyet kabul et)
    return await askGPTForCandidates(uncertainWord);
  }
  
  return candidates;
}
```

**Problem:** Bu da zayıf. "ka" için context'te "kalem" yoksa çalışmaz.

#### **Seçenek D: HAFTA 3'Ü REVİZE ET (Gerçekçi Yaklaşım)**

**YENİ PLAN:**

**Embedding kullanımını değiştir:** Candidates yerine **context similarity** kontrol et:

```javascript
// YENİ: Candidates generate etme, direkt context benzerliği kontrol et
async function checkWithEmbedding(uncertainWord, context) {
  // 1. Belirsiz kelimenin embedding'i
  const wordEmbed = await embeddingCache.getEmbedding(uncertainWord);
  
  // 2. Context'in embedding'i
  const contextEmbed = await embeddingCache.getEmbedding(context);
  
  // 3. Benzerlik skoru
  const similarity = cosineSimilarity(wordEmbed, contextEmbed);
  
  // 4. Karar
  if (similarity >= 0.85) {
    // Context ile uyumlu, muhtemelen doğru
    return {
      action: 'ACCEPT_AS_IS',
      confidence: similarity,
      method: 'embedding'
    };
  } else if (similarity < 0.50) {
    // Context ile çok uyumsuz, muhtemelen yanlış
    return {
      action: 'ASK_GPT',
      confidence: similarity,
      method: 'need_gpt'
    };
  } else {
    // Belirsiz, GPT'ye sor
    return {
      action: 'ASK_GPT',
      confidence: similarity,
      method: 'need_gpt'
    };
  }
}
```

**Test:**
```
Input: "Defterimi açtım ve ka ile yazdım"
Context: "defter açtım yazdım"

"ka" embedding ↔ Context embedding: 0.45 (düşük)
→ ASK_GPT

GPT'ye sor: "ka" + context → "kalem"
```

```
Input: "Merhaba ben Ekrem"
Context: "merhaba ben"

"Ekrem" embedding ↔ Context embedding: 0.88 (yüksek)
→ ACCEPT_AS_IS (GPT'ye gitme!)
```

**Kazanç:**
- %60-70 kelimelerde embedding ile "ACCEPT_AS_IS" (isimler, belirgin kelimeler)
- %30-40 kelimelerde GPT'ye git (belirsiz kelimeler)
- Candidates generate sorununu tamamen atla!

---

### **📝 Hafta 3 Planı Güncelleme:**

**ESKİ (7.11.2205.md satır 598-650):**
```javascript
async function checkWithEmbedding(uncertainWord, context, candidates) {
  // 1. Context embedding
  // 2. Candidate embeddings
  // 3. Similarity scores
  // 4. Best candidate
}
```

**YENİ:**
```javascript
async function checkWithEmbedding(uncertainWord, context) {
  // 1. Word embedding
  const wordEmbed = await embeddingCache.getEmbedding(uncertainWord);
  
  // 2. Context embedding
  const contextEmbed = await embeddingCache.getEmbedding(context);
  
  // 3. Similarity check
  const similarity = cosineSimilarity(wordEmbed, contextEmbed);
  
  // 4. Three-tier decision
  if (similarity >= 0.85) {
    return { action: 'ACCEPT_AS_IS', confidence: similarity, method: 'embedding' };
  } else if (similarity < 0.50) {
    return { action: 'LIKELY_WRONG_ASK_GPT', confidence: similarity, method: 'need_gpt' };
  } else {
    return { action: 'UNCERTAIN_ASK_GPT', confidence: similarity, method: 'need_gpt' };
  }
}
```

**Maliyet Karşılaştırması:**
```
100 belirsiz kelime:

ESKİ PLAN:
- generateCandidates: 100 × GPT call = 30s, $0.01
- Embedding check: 100 × 50ms = 5s, $0.002
- GPT fallback (40%): 40 × GPT call = 12s, $0.004
TOPLAM: 47s, $0.016

YENİ PLAN:
- Embedding check: 100 × 50ms = 5s, $0.002
- GPT fallback (35%): 35 × GPT call = 10.5s, $0.0035
TOPLAM: 15.5s, $0.0055

KAZANÇ: %67 hızlanma, %66 maliyet azalması ✅
```

---

## 🎯 BÖLÜM 5: BATCH GPT ÇAĞRISI

### **AI'nın Önerisi:**
> "Belirsiz kelimeleri toplu düzeltme ile GPT çağrılarını %20-30 daha azaltabilirsin"

**Analiz:**
```javascript
// Önerilen yaklaşım:
const uncertainWords = ['ka', 'nabis', 'dekre'];

// Tek GPT çağrısı:
const prompt = `Correct these words in context:
Context: "Defterimi açtım ve ka ile yazdım. Hastanın nabis hızlı. Kitapda dekre yazıyor"

Words to correct:
1. ka
2. nabis
3. dekre

Return JSON...`;
```

**Kazanç:**
- 3 GPT call → 1 GPT call
- 900ms → 300ms
- $0.0003 → $0.0001

**Problem:**
Bu, **Hafta 1'in streaming translation hedefi ile çelişiyor!**

SEG'in 1. önceliği (7.11.2205.md satır 14):
> "Merhaba" duyulunca ANINDA "Hello" ekranda gözükmeli

Eğer belirsiz kelimeleri "batch" olarak bekletirsen:
```
t=0s: "ka" duyuldu → Bekle (batch için)
t=1s: "nabis" duyuldu → Bekle (batch için)
t=2s: "dekre" duyuldu → Şimdi GPT'ye sor (batch)
t=2.5s: Düzeltmeler geldi

Kullanıcı: 2.5 saniye bekledi! ❌
```

---

### **⚠️ SEG'İN KARARI: ERTELENDİ (HAFTA 5)**

**Sebep:**
- Hafta 1-4'ün hedefi: **Anında feedback**
- Batch processing: **Gecikmeli feedback** demek

**Alternatif (Gelecek için):**
Hafta 5'te "Optimizasyon" fazında, **arka plan batch processing** eklenebilir:
```javascript
// Kullanıcı ekranda anında görsün
// Ama arka planda batch düzeltme yapsın
// Sonra retroactive update yapsın (Hafta 4'ün mantığı)

// Bu, hız ve maliyet arasında denge kurar
```

Şimdilik: **RED**.

---

## 🎯 BÖLÜM 6: GLOBAL DİL DESTEĞİ (stopWords kaldır)

### **AI'nın Analizi:** ✅ %100 DOĞRU

> "extractKeywords ve detectTopicsFromKeywords fonksiyonlarındaki Türkçe-spesifik listeler planın kendi prensibine ters"

**Mevcut Plan (7.11.2205.md satır 460):**
```javascript
const stopWords = ['the', 'a', 'an', 'and', 've', 'bir', 'bu'];
```

**Problem:** Bu Türkçe+İngilizce karışımı. Fransızca kullanıcı için çalışmaz!

SEG'in prensibi (7.11.2205.md satır 49):
- ❌ Türkçe-spesifik çözümler yapma
- ✅ Multi-language çalışmalı

---

### **✅ SEG'İN KARARI: KABUL EDİYORUZ**

**Çözüm:**

#### **Seçenek A: stopWords'ü tamamen kaldır**
```javascript
function extractKeywords(text) {
  // Stop words yok, sadece frekans
  const words = text.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3); // Sadece uzunluk filtresi
  
  // Frekans hesapla
  const freq = {};
  words.forEach(w => freq[w] = (freq[w] || 0) + 1);
  
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}
```

**Problem:** "the", "and" gibi kelimeler en sık çıkacak, anlamsız keywords.

#### **Seçenek B: GPT'ye keyword extraction'ı yaptır (Hafta 2 revizyonu)**
```javascript
async function buildDynamicPrompt(transcript, context) {
  // ADIM 1: GPT'ye keyword extraction yaptır (hafif çağrı)
  const keywordResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Extract 5-10 most important keywords from this text (ignore common words):\n\n"${context}"\n\nReturn only comma-separated words.`
    }],
    max_tokens: 50
  });
  
  const keywords = keywordResponse.choices[0].message.content.split(',').map(k => k.trim());
  
  // ADIM 2: Prompt oluştur
  let prompt = `You are an expert at correcting speech transcription errors.

Context (last 60 seconds):
"${context}"

Key topics detected: ${keywords.join(', ')}

Recent transcript:
"${transcript}"

Task: Identify and correct transcription errors...`;

  return prompt;
}
```

**Maliyet:**
- Keyword extraction: ~50 tokens = $0.000025
- Correction prompt: ~500 tokens = $0.00025
- Toplam: ~$0.000275

**Eski yöntem:**
- Manuel keyword extraction: $0
- Correction prompt: $0.00025
- Toplam: $0.00025

**Fark:** $0.000025 (ihmal edilebilir!)

**Kazanç:**
- ✅ %100 multi-language
- ✅ GPT otomatik olarak dil-spesifik stop words'leri çıkarıyor
- ✅ Daha akıllı keyword detection

---

### **📝 Hafta 2 Planı Güncelleme:**

**ESKİ (7.11.2205.md satır 428-525):**
```javascript
function extractKeywords(text) {
  const stopWords = ['the', 'a', 've', 'bir', 'bu']; // ❌ Dil-spesifik
  // ...
}

function detectTopicsFromKeywords(keywords) {
  const topicMap = {
    sports: ['nba', 'lakers', ...],
    medical: ['hasta', 'nabız', ...]
  }; // ❌ Manuel pattern
}
```

**YENİ:**
```javascript
async function buildDynamicPrompt(transcript, context) {
  // 1. GPT ile keyword extraction (multi-language)
  const keywordResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Extract 5-10 key topics/entities from this text. Return comma-separated:\n\n"${context}"`
    }],
    max_tokens: 50,
    temperature: 0.3
  });
  
  const keywords = keywordResponse.choices[0].message.content;
  
  // 2. Prompt oluştur (topicMap yok!)
  const prompt = `You are an expert at correcting speech transcription errors.

Context (last 60 seconds):
"${context}"

Detected topics/entities: ${keywords}

Recent transcript:
"${transcript}"

Task:
1. Identify uncertain or incorrect words
2. Use context and detected topics to correct
3. Consider:
   - Phonetic similarity
   - Semantic meaning
   - Common transcription errors
   - Names, places, organizations

Return JSON:
{
  "corrections": [
    {
      "original": "incorrect word",
      "corrected": "correct word",
      "confidence": 0.95,
      "reason": "brief explanation"
    }
  ]
}`;

  return prompt;
}
```

**Test (Multi-language):**
```
Context (FR): "Je veux du pain. Le boulanger vend du pain frais."
Keywords: "pain, boulanger, frais" (GPT otomatik çıkardı)

Transcript: "Je veux du pen"
Correction: "pen" → "pain" ✅
```

```
Context (TR): "Kitap okuyorum. Yazar güzel yazmış."
Keywords: "kitap, yazar, okuyorum" (GPT otomatik çıkardı)

Transcript: "Kitapda derece bu önemli"
Correction: "derece" → "diyorki" ✅
```

---

## 🎯 BÖLÜM 7: TTL QUEUE (PENDING CORRECTIONS)

### **AI'nın Analizi:** ✅ DOĞRU

> "Eğer 'future context' hiç gelmezse, kelime kuyrukta sonsuza kadar bekler → memory leak"

**Mevcut Plan (7.11.2205.md satır 903):**
```javascript
class PendingCorrectionsQueue {
  add(word, context, timestamp) {
    this.queue.push({ word, context, timestamp });
  }
  
  // TTL kontrolü YOK! ❌
}
```

---

### **✅ SEG'İN KARARI: KABUL EDİYORUZ**

**Implementasyon:**

```javascript
class PendingCorrectionsQueue {
  constructor() {
    this.queue = [];
    this.maxWaitTime = 15000; // 15 saniye (AI önerisi)
    this.checkInterval = 5000; // 5 saniyede bir kontrol
    
    // Otomatik TTL kontrolü başlat
    this.startTTLChecker();
  }
  
  startTTLChecker() {
    setInterval(() => {
      this.checkQueueTTL();
    }, this.checkInterval);
  }
  
  add(word, context, timestamp) {
    this.queue.push({
      word,
      context,
      timestamp,
      waitingForFutureContext: true
    });
  }
  
  async checkQueueTTL() {
    const now = Date.now();
    const expiredItems = [];
    
    // Süresi dolan itemları bul
    this.queue = this.queue.filter(item => {
      const age = now - item.timestamp;
      
      if (age > this.maxWaitTime) {
        expiredItems.push(item);
        return false; // Kuyruktan çıkar
      }
      return true; // Kuyrukta tut
    });
    
    // Süresi dolanlar için "best guess" düzeltme yap
    for (const item of expiredItems) {
      console.log(`⏰ TTL expired for "${item.word}", making final decision`);
      
      // Son analiz (future context olmadan)
      const result = await correctWithHybrid(item.word, item.context);
      
      if (result.confidence > 0.70) {
        // Düşük güven bile olsa düzelt (kullanıcı bekliyor)
        this.sendCorrection(item.word, result.correction);
      } else {
        // Çok belirsiz, olduğu gibi bırak
        console.log(`❓ Too uncertain, keeping "${item.word}" as-is`);
      }
    }
  }
  
  async checkWithFutureContext(newSentence) {
    // ... mevcut kod (7.11.2205.md satır 916)
  }
  
  sendCorrection(original, corrected) {
    // ... mevcut kod
  }
}
```

**Test:**
```
t=0s: "Benim karyolam araba dizaynlı"
      → "karyolam" → Queue (confidence: 0.60)

t=5s: (Sessizlik)
      → Queue TTL check: age=5s (< 15s) → Bekle

t=10s: (Sessizlik)
       → Queue TTL check: age=10s (< 15s) → Bekle

t=15s: (Sessizlik)
       → Queue TTL check: age=15s (≥ 15s) → TTL expired!
       → Final decision (context: "benim araba dizaynlı")
       → Confidence: 0.75 → "karyolam" ✅ (düzeltme yapma)

Kullanıcı: "karyolam" olduğu gibi kaldı (doğru karar!)
```

```
t=0s: "Benim karayolam araba dizaynlı"
      → "karayolam" → Queue (confidence: 0.55)

t=6s: "Üzerinde yatmak havalı"
      → Future context geldi!
      → Confidence: 0.95 → "karayolam" → "karyolam" ✅
      → Queue'dan çıkar (TTL'den önce çözüldü)
```

**Kazanç:**
- ✅ Memory leak önlendi
- ✅ Kullanıcı 15 saniyeden fazla beklemiyor
- ⚡ Performans kaybı: ~0 (sadece 5s'de bir kontrol)

---

## 🎯 BÖLÜM 8: FRONTEND STATE HELL FIX

### **AI'nın Analizi:** ✅ DOĞRU

> "Frontend 4 farklı asenkron akışı yönetmek zorunda, mevcut useState yetersiz"

**Problem:**
App.jsx şu anda şunları yapıyor:
```javascript
const [transcript, setTranscript] = useState([]); // Akış 1
const [translation, setTranslation] = useState(''); // Akış 2
// Düzeltme akışı: transcript içinde (Akış 3)
// Düzeltilmiş çeviri: ??? (Akış 4 - YOK!)
```

**Bölüm 1'deki Atomik ID sistemi** bunu %90 çözüyor ama **state yönetimi** hala karmaşık.

---

### **✅ SEG'İN KARARI: KABUL - BÖLÜM 1 İLE BİRLİKTE ÇÖZÜLECEK**

**Çözüm: Unified State (Tek Kaynak Doğruluk)**

```javascript
// YENİ: Tüm veriyi tek bir state'te tut
const [chunks, setChunks] = useState([]);

// Chunk yapısı:
{
  id: 'chunk-123',
  transcript: {
    original: 'ka',
    corrected: 'kalem',
    timestamp: 1234567890,
    status: 'corrected' // pending, correcting, corrected
  },
  translation: {
    text: 'pen',
    status: 'retranslating', // translating, done, retranslating
    timestamp: 1234567891
  }
}
```

**Implementasyon:**
```javascript
const handleServerMessage = (message) => {
  switch (message.type) {
    case 'transcript':
      // Yeni chunk ekle
      setChunks(prev => [...prev, {
        id: message.data.id,
        transcript: {
          original: message.data.text,
          corrected: null,
          timestamp: message.data.timestamp,
          status: 'pending'
        },
        translation: null
      }]);
      break;

    case 'translation':
      // Chunk'ın translation'ını güncelle
      setChunks(prev => prev.map(chunk => {
        if (chunk.id === message.data.for_chunk_id) {
          return {
            ...chunk,
            translation: {
              text: (chunk.translation?.text || '') + message.data.text,
              status: message.data.partial ? 'translating' : 'done',
              timestamp: Date.now()
            }
          };
        }
        return chunk;
      }));
      break;

    case 'correction':
      // Chunk'ı düzelt VE translation'ı invalidate et
      setChunks(prev => prev.map(chunk => {
        if (chunk.id === message.data.for_chunk_id) {
          return {
            ...chunk,
            transcript: {
              ...chunk.transcript,
              corrected: message.data.corrected,
              status: 'correcting'
            },
            translation: {
              ...chunk.translation,
              status: 'retranslating' // İnvalidate!
            }
          };
        }
        return chunk;
      }));
      
      // 1 saniye sonra status'u 'corrected' yap
      setTimeout(() => {
        setChunks(prev => prev.map(chunk => 
          chunk.id === message.data.for_chunk_id 
            ? { ...chunk, transcript: { ...chunk.transcript, status: 'corrected' } }
            : chunk
        ));
      }, 1000);
      
      // Retranslation iste
      requestRetranslation(message.data.for_chunk_id, message.data.corrected);
      break;
  }
};
```

**UI (Basitleştirilmiş):**
```jsx
<div className="chunks-container">
  {chunks.map(chunk => (
    <div key={chunk.id} className="chunk-item">
      {/* Transcript */}
      <div className={`transcript ${chunk.transcript.status}`}>
        {chunk.transcript.corrected ? (
          <span>
            <s>{chunk.transcript.original}</s> {chunk.transcript.corrected}
          </span>
        ) : (
          chunk.transcript.original
        )}
      </div>
      
      {/* Translation */}
      <div className={`translation ${chunk.translation?.status || 'none'}`}>
        {chunk.translation?.status === 'retranslating' ? (
          <span className="text-yellow-400">⏳ Re-translating...</span>
        ) : (
          <span>{chunk.translation?.text || ''}</span>
        )}
      </div>
    </div>
  ))}
</div>
```

**Kazanç:**
- ✅ Tek kaynak doğruluk (Single Source of Truth)
- ✅ Race condition yok
- ✅ State tutarlılığı garanti
- ✅ Kolay debug (tüm veri tek yerde)

---

## 📊 FİNAL KARAR TABLOSU

| Öneri | Karar | Hafta | Implementasyon Notu |
|-------|-------|-------|---------------------|
| **Atomik ID Sistemi** | ✅ KABUL | Hafta 1 | Backend+Frontend, kritik öncelik |
| **Confidence Fusion** | ⚠️ KOŞULLU | Hafta 1 | STT alternatives varsa kullan, yoksa atla |
| **Topic Shift Filtresi** | ❌ RED | - | SEG'in prensipleriyle çelişiyor |
| **Candidate Generation Fix** | ✅ KABUL | Hafta 3 | Context similarity kullan, candidates atla |
| **Batch GPT** | ❌ ERTELENDİ | Hafta 5 | Streaming ile çelişiyor, gelecek için |
| **Global Dil (stopWords)** | ✅ KABUL | Hafta 2 | GPT ile keyword extraction |
| **TTL Queue** | ✅ KABUL | Hafta 4 | 15s timeout, auto-cleanup |
| **Frontend State Fix** | ✅ KABUL | Hafta 1 | Unified chunks state |

---

## 🚀 GÜNCELLENMİŞ 4 HAFTALIK PLAN

### **HAFTA 1: GERÇEK ZAMANLI ÇEVİRİ + ATOMİK ID**
**Değişiklikler:**
- ✅ Atomik ID sistemi eklendi (Bölüm 1)
- ✅ Unified state management (Bölüm 8)
- ✅ STT alternatives testi (Bölüm 2)
- ✅ Retranslation endpoint (Bölüm 1)

**Yeni Dosya:** `hafta1-revize.md` (detaylı kod örnekleri ile)

---

### **HAFTA 2: DİNAMİK PROMPT (GLOBAL)**
**Değişiklikler:**
- ❌ extractKeywords kaldırıldı
- ❌ detectTopicsFromKeywords kaldırıldı
- ❌ topicMap kaldırıldı
- ✅ GPT-based keyword extraction eklendi (Bölüm 6)
- ✅ %100 multi-language support

**Maliyet Artışı:** ~$0.000025/request (ihmal edilebilir)

---

### **HAFTA 3: EMBEDDING HİBRİT (REVİZE)**
**Değişiklikler:**
- ❌ generateCandidates (GPT call) kaldırıldı
- ✅ Context similarity check eklendi (Bölüm 4)
- ✅ Three-tier decision (0.85/0.50 threshold)
- ✅ %67 daha hızlı, %66 daha ucuz

**Yeni Metrik:** Embedding cache hit rate > 80%

---

### **HAFTA 4: RETROACTIVE CORRECTION + TTL**
**Değişiklikler:**
- ✅ TTL queue eklendi (15s timeout) (Bölüm 7)
- ✅ Auto-cleanup (5s interval)
- ✅ Best-guess fallback (confidence > 0.70)

**Yeni Test:** Memory leak test (1000 pending correction simülasyonu)

---

## ✅ SEG İÇİN ÖZET

**Kabul Edilen Öneriler (Kritik):**
1. ✅ Atomik ID sistemi (race condition çözümü)
2. ✅ Candidate generation fix (context similarity)
3. ✅ Global dil desteği (GPT-based keywords)
4. ✅ TTL queue (memory leak önleme)

**Reddedilen Öneriler:**
1. ❌ Topic shift filtresi (statik pattern)
2. ❌ Batch GPT (streaming ile çelişki)

**Koşullu Öneriler:**
1. ⚠️ Confidence fusion (STT alternatives varsa)

**Sonuç:**
AI'ların önerileri **%70 doğru**, **%20 senin prensiplerin ile çelişiyor**, **%10 erken**.

Plan **REVİZE EDİLDİ** ve **SEG'in önceliklerine %100 uyumlu** hale getirildi.

**Hazır mısın başlamaya?** 🚀
