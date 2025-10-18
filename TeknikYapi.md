# 🏗️ Real-time AI Translator - Teknik Mimari

## 📐 Sistem Mimarisi

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Microphone  │───▶│ Audio Buffer │───▶│  WebSocket   │      │
│  │   Web API    │    │  (PCM16)     │    │   Client     │      │
│  └──────────────┘    └──────────────┘    └──────┬───────┘      │
│                                                   │               │
│  ┌──────────────────────────────────────────────▼──────────┐   │
│  │           React State Management                        │   │
│  │  • transcript[]  • corrections[]  • translation         │   │
│  └──────────────────────────────────────────────┬──────────┘   │
│                                                   │               │
│  ┌──────────────────────────────────────────────▼──────────┐   │
│  │         Correction Animation Engine                     │   │
│  │  1. Detect correction                                   │   │
│  │  2. Fade to gray (500ms)                               │   │
│  │  3. Morph to new word (300ms)                          │   │
│  │  4. Highlight in green (200ms)                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────┬───────────────────────────────────┘
                                │ WebSocket (ws://)
                                │
┌───────────────────────────────▼───────────────────────────────────┐
│                    BACKEND SERVER (Node.js)                        │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              WebSocket Server (ws library)                  │  │
│  │  • Session Management                                       │  │
│  │  • Audio Streaming                                          │  │
│  │  • Message Routing                                          │  │
│  └────────┬──────────────────────────────┬────────────────────┘  │
│           │                               │                        │
│           ▼                               ▼                        │
│  ┌─────────────────────┐      ┌─────────────────────────┐        │
│  │  TranscriptionSession│      │   Context Analyzer      │        │
│  │                      │      │                         │        │
│  │  • contextBuffer[]   │◀────▶│  • Rolling Window (60s) │        │
│  │  • currentContext    │      │  • Analysis Trigger (5s)│        │
│  │  • pendingCorrections│      │  • Topic Detection      │        │
│  └──────────┬───────────┘      └─────────┬───────────────┘        │
│             │                             │                         │
│             ▼                             ▼                         │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                  AI Pipeline Manager                      │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐        │    │
│  │  │ Pipeline 1 │  │ Pipeline 2 │  │ Pipeline 3 │        │    │
│  │  │Transcription│  │ Correction │  │Translation │        │    │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │    │
│  └────────┼───────────────┼───────────────┼────────────────┘    │
│           │               │               │                       │
└───────────┼───────────────┼───────────────┼───────────────────────┘
            │               │               │
            ▼               ▼               ▼
┌───────────────────────────────────────────────────────────────────┐
│                     OPENAI API SERVICES                            │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌─────────────┐│
│  │ Realtime API         │  │  GPT-4o-mini     │  │   GPT-4o    ││
│  │ (gpt-4o-realtime)    │  │  (Correction)    │  │(Translation)││
│  │                      │  │                  │  │             ││
│  │ • STT Streaming      │  │ • NER            │  │ • Context   ││
│  │ • 300-800ms latency  │  │ • Context        │  │ • Streaming ││
│  │ • WebSocket based    │  │ • JSON Output    │  │ • Entities  ││
│  └──────────────────────┘  └──────────────────┘  └─────────────┘│
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🧮 Core Algoritmalar

### 1. Rolling Context Window Algorithm

**Amaç:** Son 60 saniyelik konuşmayı hafızada tut, bağlam için kullan

```javascript
class ContextBuffer {
  constructor(windowSize = 60000) { // 60 saniye (ms)
    this.buffer = [];
    this.windowSize = windowSize;
  }

  add(text, timestamp) {
    // Yeni entry ekle
    this.buffer.push({ text, timestamp });
    
    // Eski entryleri temizle (sliding window)
    const cutoff = Date.now() - this.windowSize;
    this.buffer = this.buffer.filter(item => item.timestamp > cutoff);
  }

  getContext() {
    return this.buffer.map(item => item.text).join(' ');
  }
  
  getRecentContext(seconds = 10) {
    const cutoff = Date.now() - (seconds * 1000);
    return this.buffer
      .filter(item => item.timestamp > cutoff)
      .map(item => item.text)
      .join(' ');
  }
}
```

**Neden 60 saniye?**
- Çok kısa (10s): Bağlam yetersiz, hatalı düzeltme riski
- Çok uzun (120s): Bellek yükü, alakasız bilgi
- 60s: Optimal denge (NBA→RNA dönüşümü için yeterli)

---

### 2. Context-Aware NER Correction Algorithm

**Amaç:** Yanlış transkribe edilmiş entity'leri bağlama göre düzelt

```python
# Pseudo-algorithm
def correct_entities(transcript, context):
    # 1. Domain Detection
    detected_topics = analyze_topics(context)
    # Output: ["sports", "basketball"]
    
    # 2. Entity Extraction
    entities = extract_entities(transcript)
    # Output: ["NBC", "MVW", "Lebron Harden"]
    
    # 3. Candidate Generation
    candidates = {}
    for entity in entities:
        candidates[entity] = generate_candidates(entity, detected_topics)
        # "NBC" → ["NBA", "NBC News", "MSNBC"]
    
    # 4. Contextual Ranking
    for entity, options in candidates.items():
        scores = []
        for option in options:
            # Semantic similarity with context
            semantic_score = cosine_similarity(
                embedding(context), 
                embedding(option)
            )
            
            # Domain relevance
            domain_score = check_domain_relevance(option, detected_topics)
            
            # Phonetic similarity (homophones)
            phonetic_score = phonetic_distance(entity, option)
            
            # Combined score
            total_score = (
                0.5 * semantic_score + 
                0.3 * domain_score + 
                0.2 * phonetic_score
            )
            scores.append((option, total_score))
        
        # Best candidate
        best = max(scores, key=lambda x: x[1])
        if best[1] > CONFIDENCE_THRESHOLD:
            corrections.append({
                "original": entity,
                "corrected": best[0],
                "confidence": best[1]
            })
    
    return corrections
```

**Örnek Çalışma:**

```
Input: "NBC tarafından MVW ödülü verildi"
Context: "basketbol oyuncusu takım final serisinde..."

Step 1: Topic = "sports/basketball"

Step 2: Entities = ["NBC", "MVW"]

Step 3: Candidates = {
    "NBC": ["NBA", "NBC News", "MSNBC"],
    "MVW": ["MVP", "MVW Auto", "MW"]
}

Step 4: Scoring
"NBC" → "NBA":
  - Semantic: 0.92 (basketball context)
  - Domain: 1.0 (basketball organization)
  - Phonetic: 0.85 (similar sound)
  - Total: 0.92

"MVW" → "MVP":
  - Semantic: 0.88 (sports award)
  - Domain: 1.0 (sports)
  - Phonetic: 0.90
  - Total: 0.91

Output: [
    {"original": "NBC", "corrected": "NBA", "confidence": 0.92},
    {"original": "MVW", "corrected": "MVP", "confidence": 0.91}
]
```

---

### 3. Dynamic Prompt Injection Algorithm

**Amaç:** AI'ya bağlama özel talimatlar ver

```javascript
function buildDynamicPrompt(context, recentTranscript) {
  // 1. Topic Detection
  const topics = detectTopics(context);
  
  // 2. Domain-Specific Knowledge Base
  const domainKB = {
    sports: {
      organizations: ["NBA", "FIFA", "UEFA", "NFL"],
      awards: ["MVP", "Ballon d'Or", "Golden Boot"],
      common_errors: [
        { from: "NBC", to: "NBA" },
        { from: "MVW", to: "MVP" }
      ]
    },
    science: {
      terms: ["DNA", "RNA", "ATP", "mRNA"],
      common_errors: [
        { from: "DNA", to: "DNA", context: "avoid NBA" }
      ]
    }
  };
  
  // 3. Build Contextual Prompt
  let prompt = `You are correcting speech transcription errors.

Current conversation topic: ${topics.join(', ')}
Context: "${context}"
Latest transcript: "${recentTranscript}"

`;

  // Add domain-specific guidance
  topics.forEach(topic => {
    if (domainKB[topic]) {
      prompt += `\n${topic.toUpperCase()} Context Rules:
- Valid terms: ${domainKB[topic].organizations || domainKB[topic].terms}
- Common corrections: ${JSON.stringify(domainKB[topic].common_errors)}
`;
    }
  });

  prompt += `\nFind errors and return corrections as JSON.`;
  
  return prompt;
}
```

**Avantaj:** Her domain için özelleşmiş düzeltme kuralları

---

### 4. Retroactive Correction with Smooth Animation

**Problem:** "RNA" önce "NBA" olarak düzeltilebilir, sonraki cümle ile tekrar "RNA" olmalı

**Çözüm:** Multi-stage correction

```javascript
class RetroactiveCorrector {
  constructor() {
    this.history = []; // Tüm düzeltme geçmişi
    this.confidence_threshold = 0.85;
  }

  async analyzeWithFuture(pastTranscript, currentTranscript, futureContext) {
    // Stage 1: Immediate correction (low confidence)
    const immediate = await correctWithContext(
      currentTranscript, 
      pastTranscript
    );
    
    // Stage 2: Wait for future context (2-3 saniye)
    await sleep(2500);
    
    // Stage 3: Re-analyze with future context
    const refined = await correctWithContext(
      currentTranscript,
      pastTranscript + " " + futureContext
    );
    
    // Stage 4: Compare and update if necessary
    for (let i = 0; i < immediate.length; i++) {
      const oldCorrection = immediate[i];
      const newCorrection = refined[i];
      
      if (oldCorrection.corrected !== newCorrection.corrected) {
        // Context changed the correction!
        await this.animateReCorrection(oldCorrection, newCorrection);
      }
    }
  }
  
  async animateReCorrection(old, new) {
    // Visual feedback: "NBA" → gray → "RNA"
    emit('correction_update', {
      from: old.corrected,
      to: new.corrected,
      reason: "Context refinement",
      animation: {
        stage1: { color: 'gray', duration: 500 },
        stage2: { color: 'blue', scale: 1.1, duration: 300 },
        stage3: { color: 'normal', duration: 200 }
      }
    });
  }
}
```

**Örnek Timeline:**

```
T=0s:   "RNA polimeraz..." (konuşuldu)
T=0.5s: AI: "Basketbol context var, belki NBA?"
        → Ekranda "NBA" göster (düşük güven)
        
T=3s:   "...enzimi DNA'yı kopyalar" (devam edildi)
T=3.5s: AI: "Ah hayır, bu biyoloji! RNA doğruymuş"
        → Animasyon: NBA → [gray] → RNA
        
Result: Kullanıcı düzeltmeyi gerçek zamanlı görür!
```

---

### 5. Streaming Translation Algorithm

**Amaç:** Cümle bitmeden çeviriye başla, ama context koru

```javascript
class StreamingTranslator {
  constructor() {
    this.buffer = "";
    this.sentenceDetector = new SentenceDetector();
    this.MIN_WORDS = 5;
  }

  async translate(chunk, targetLang, context) {
    this.buffer += chunk;
    
    // Sentence boundary detection
    const boundaries = this.sentenceDetector.detect(this.buffer);
    
    if (boundaries.length > 0 || this.buffer.split(' ').length >= this.MIN_WORDS) {
      // Translate accumulated buffer
      const toTranslate = this.buffer;
      this.buffer = ""; // Reset
      
      // Stream translation
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Translate to ${targetLang}. Preserve entities. Context: ${context}`
          },
          {
            role: "user",
            content: toTranslate
          }
        ],
        stream: true
      });
      
      for await (const chunk of stream) {
        yield chunk.choices[0]?.delta?.content || '';
      }
    }
  }
}

class SentenceDetector {
  detect(text) {
    // Definite boundaries
    const definite = /[.!?]\s+[A-ZÇĞİÖŞÜ]/g;
    
    // Probable boundaries (clauses)
    const probable = /[,;:]\s+/g;
    
    // Time-based heuristic
    const wordCount = text.split(' ').length;
    const timeSinceLastBoundary = Date.now() - this.lastBoundary;
    
    if (wordCount > 15 || timeSinceLastBoundary > 3000) {
      return ['probable_boundary'];
    }
    
    return text.match(definite) || [];
  }
}
```

**Strateji:**
1. Minimum 5 kelime biriktir
2. Cümle sınırı bulunca çevir
3. 3 saniye bekle, yoksa zorla çevir
4. Sonraki cümleyi context olarak kullan

---

## 🔬 Performans Metrikleri

### Latency Breakdown

```
Total End-to-End Latency: ~2-4 saniye

┌─────────────────────────────────────────────────────────────┐
│ Speech → Transcript → Correction → Translation              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Audio Capture]  100ms                                     │
│        ↓                                                     │
│  [WebSocket]      50ms                                      │
│        ↓                                                     │
│  [Realtime STT]   300-800ms (OpenAI)                        │
│        ↓                                                     │
│  [Context Buffer] 10ms                                      │
│        ↓                                                     │
│  [NER Correction] 500-1000ms (GPT-4o-mini, every 5s)       │
│        ↓                                                     │
│  [Translation]    1000-2000ms (GPT-4o, streaming)           │
│                                                              │
│  TOTAL:           ~2000-4000ms                              │
└─────────────────────────────────────────────────────────────┘
```

### Accuracy Metrics

```
Target Benchmarks:

✅ Word Error Rate (WER): <5%
   - OpenAI Whisper: ~3-4% (state-of-the-art)

✅ Entity Recognition Accuracy: >90%
   - Common homophones: 95%
   - Domain-specific terms: 92%
   - Person names: 88%

✅ Translation Quality (BLEU): >40
   - GPT-4o: 45-50 BLEU score
   - Human parity: ~50-55 BLEU

✅ Context Switch Detection: >85%
   - Topic change detection
   - Retroactive correction accuracy
```

---

## 🚀 Optimization Techniques

### 1. Request Batching

```javascript
// Her 5 saniye yerine, akıllı batching
class SmartBatcher {
  queue = [];
  
  add(transcript) {
    this.queue.push(transcript);
    
    // Batch conditions
    const shouldProcess = 
      this.queue.length >= 3 ||  // 3+ transcript
      this.hasTopicChange() ||    // Topic değişti
      this.hasUncertainty();      // Belirsizlik var
    
    if (shouldProcess) {
      this.processBatch();
    }
  }
}
```

### 2. Caching

```javascript
// Sık kullanılan düzeltmeleri cache'le
const correctionCache = new Map();

function getCachedCorrection(entity, context) {
  const key = `${entity}:${getTopicHash(context)}`;
  
  if (correctionCache.has(key)) {
    return correctionCache.get(key);
  }
  
  // API call...
  const result = await correctEntity(entity, context);
  correctionCache.set(key, result);
  
  return result;
}
```

### 3. Parallel Processing

```javascript
// Correction ve Translation paralel çalış
async function processTranscript(text) {
  const [corrections, translation] = await Promise.all([
    correctEntities(text),
    translateText(text)
  ]);
  
  return { corrections, translation };
}
```

---

## 📊 Scaling Strategy

### Horizontal Scaling

```
┌────────────┐
│ Load       │
│ Balancer   │
└─────┬──────┘
      │
      ├────▶ [Backend Instance 1] ─┐
      ├────▶ [Backend Instance 2] ─┤─▶ Redis (Session Store)
      └────▶ [Backend Instance 3] ─┘
```

### Vertical Optimization

```javascript
// Worker threads for heavy processing
const { Worker } = require('worker_threads');

const correctionWorker = new Worker('./correction-worker.js');

correctionWorker.postMessage({ transcript, context });
correctionWorker.on('message', (corrections) => {
  // Handle corrections
});
```

---

## 🎯 Success Criteria

1. **Latency:** <4s end-to-end
2. **Accuracy:** >90% entity correction
3. **Uptime:** 99.9%
4. **Concurrent Users:** 100+
5. **Cost:** <$0.10 per minute

---

**Bu mimari, endüstri standartlarında production-ready bir sistem!** 🚀