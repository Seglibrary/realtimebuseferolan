# 🚀 Advanced Features & Production Optimizations

## 🎯 Phase 2: Advanced Features

### 1. Multi-Speaker Diarization

**Amaç:** Birden fazla konuşmacıyı ayırt et ve label'la

```javascript
// Backend - Speaker Detection Module
import { createClient } from '@deepgram/sdk';

class SpeakerDiarization {
  constructor() {
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.speakers = new Map();
  }

  async detectSpeakers(audioBuffer) {
    const { result } = await this.deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2',
        diarize: true,
        punctuate: true,
        utterances: true
      }
    );

    // Parse speaker segments
    const segments = result.results.utterances.map(utt => ({
      speaker: utt.speaker,
      text: utt.transcript,
      start: utt.start,
      end: utt.end,
      confidence: utt.confidence
    }));

    return segments;
  }

  assignSpeakerNames(segments) {
    // AI-powered speaker identification
    segments.forEach(seg => {
      if (!this.speakers.has(seg.speaker)) {
        // Generate label
        this.speakers.set(seg.speaker, {
          id: seg.speaker,
          label: `Speaker ${this.speakers.size + 1}`,
          voiceProfile: this.extractVoiceProfile(seg)
        });
      }
    });

    return segments.map(seg => ({
      ...seg,
      speakerInfo: this.speakers.get(seg.speaker)
    }));
  }
}

// Frontend Component
function MultiSpeakerTranscript({ segments }) {
  const colors = ['blue', 'green', 'purple', 'orange', 'pink'];
  
  return (
    <div className="space-y-3">
      {segments.map((seg, idx) => (
        <div 
          key={idx}
          className={`p-3 rounded-lg border-l-4 border-${colors[seg.speaker % colors.length]}-500 bg-slate-700/50`}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-3 h-3 rounded-full bg-${colors[seg.speaker % colors.length]}-500`} />
            <span className="text-sm font-semibold">{seg.speakerInfo.label}</span>
            <span className="text-xs text-gray-400">{formatTime(seg.start)}</span>
          </div>
          <p className="text-gray-200">{seg.text}</p>
        </div>
      ))}
    </div>
  );
}
```

---

### 2. Emotion & Sentiment Detection

**Amaç:** Konuşmacının duygusal tonunu algıla

```javascript
// Backend - Emotion Analysis
class EmotionDetector {
  async analyzeEmotion(text, audioFeatures) {
    const prompt = `Analyze the emotion and sentiment in this speech:

Text: "${text}"
Audio features: tone=${audioFeatures.tone}, pitch=${audioFeatures.pitch}, pace=${audioFeatures.pace}

Return JSON:
{
  "emotion": "happy|sad|angry|neutral|excited|anxious",
  "sentiment": "positive|negative|neutral",
  "confidence": 0.0-1.0,
  "intensity": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an emotion analysis expert.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  extractAudioFeatures(audioBuffer) {
    // Use Web Audio API or external library
    const analyzer = new AudioAnalyzer(audioBuffer);
    
    return {
      tone: analyzer.getTone(), // Formal/Casual/Aggressive
      pitch: analyzer.getAveragePitch(),
      pace: analyzer.getSpeechRate(),
      volume: analyzer.getAverageVolume()
    };
  }
}

// Frontend - Emotion Visualization
function EmotionIndicator({ emotion, intensity }) {
  const emojis = {
    happy: '😊',
    sad: '😢',
    angry: '😠',
    neutral: '😐',
    excited: '🤩',
    anxious: '😰'
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-2xl">{emojis[emotion]}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${intensity * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-400">{emotion}</span>
    </div>
  );
}
```

---

### 3. Custom Domain Dictionaries

**Amaç:** Kullanıcı kendi industry-specific terimlerini ekleyebilsin

```javascript
// Backend - Dictionary Manager
class CustomDictionary {
  constructor() {
    this.userDictionaries = new Map();
  }

  async addUserDictionary(userId, dictionary) {
    // Dictionary format:
    // {
    //   domain: "medical",
    //   terms: [
    //     { term: "MRI", variants: ["MRİ", "mri", "em ar ay"], context: "imaging" },
    //     { term: "CT scan", variants: ["siti", "si ti"], context: "radiology" }
    //   ]
    // }

    this.userDictionaries.set(userId, dictionary);
    
    // Train custom correction model
    await this.trainCustomModel(userId, dictionary);
  }

  async correctWithCustomDict(userId, text, context) {
    const userDict = this.userDictionaries.get(userId);
    if (!userDict) return text;

    let correctedText = text;
    
    // Apply custom corrections
    userDict.terms.forEach(term => {
      term.variants.forEach(variant => {
        const regex = new RegExp(`\\b${variant}\\b`, 'gi');
        
        // Check context match
        if (this.matchesContext(context, term.context)) {
          correctedText = correctedText.replace(regex, term.term);
        }
      });
    });

    return correctedText;
  }

  matchesContext(text, requiredContext) {
    // Semantic similarity check
    const similarity = this.calculateSimilarity(text, requiredContext);
    return similarity > 0.7;
  }
}

// Frontend - Dictionary Manager UI
function DictionaryManager({ userId }) {
  const [terms, setTerms] = useState([]);
  const [newTerm, setNewTerm] = useState({ term: '', variants: [], context: '' });

  const addTerm = () => {
    const updated = [...terms, newTerm];
    setTerms(updated);
    
    // Save to backend
    fetch('/api/dictionary', {
      method: 'POST',
      body: JSON.stringify({ userId, terms: updated })
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Custom Dictionary</h3>
      
      <div className="bg-slate-800 rounded-lg p-4">
        <input
          placeholder="Correct Term (e.g., MRI)"
          value={newTerm.term}
          onChange={e => setNewTerm({...newTerm, term: e.target.value})}
          className="w-full bg-slate-700 rounded px-3 py-2 mb-2"
        />
        <input
          placeholder="Variants (comma-separated: MRİ, mri, em ar ay)"
          value={newTerm.variants.join(', ')}
          onChange={e => setNewTerm({...newTerm, variants: e.target.value.split(',')})}
          className="w-full bg-slate-700 rounded px-3 py-2 mb-2"
        />
        <input
          placeholder="Context (e.g., medical imaging)"
          value={newTerm.context}
          onChange={e => setNewTerm({...newTerm, context: e.target.value})}
          className="w-full bg-slate-700 rounded px-3 py-2 mb-2"
        />
        <button 
          onClick={addTerm}
          className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded"
        >
          Add Term
        </button>
      </div>

      <div className="space-y-2">
        {terms.map((term, idx) => (
          <div key={idx} className="bg-slate-700/50 rounded p-3">
            <div className="font-semibold">{term.term}</div>
            <div className="text-sm text-gray-400">
              Variants: {term.variants.join(', ')}
            </div>
            <div className="text-xs text-gray-500">Context: {term.context}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Confidence-Based Correction Levels

**Amaç:** Kullanıcı agresiflik seviyesini ayarlayabilsin

```javascript
// Backend - Configurable Correction Engine
class ConfigurableCorrectionEngine {
  constructor() {
    this.profiles = {
      conservative: {
        minConfidence: 0.95,
        requireMultipleSignals: true,
        waitForFutureContext: true,
        description: 'Only correct when absolutely certain'
      },
      balanced: {
        minConfidence: 0.85,
        requireMultipleSignals: true,
        waitForFutureContext: false,
        description: 'Good balance of speed and accuracy'
      },
      aggressive: {
        minConfidence: 0.70,
        requireMultipleSignals: false,
        waitForFutureContext: false,
        description: 'Faster corrections, may have more false positives'
      }
    };
  }

  async correct(text, context, profile = 'balanced') {
    const config = this.profiles[profile];
    const corrections = await this.findPotentialCorrections(text, context);

    // Filter by confidence
    let filtered = corrections.filter(c => c.confidence >= config.minConfidence);

    // Additional validation
    if (config.requireMultipleSignals) {
      filtered = filtered.filter(c => this.hasMultipleSignals(c, context));
    }

    // Wait for future context
    if (config.waitForFutureContext) {
      await this.delay(2000);
      const futureContext = await this.getFutureContext();
      filtered = await this.revalidateWithFuture(filtered, futureContext);
    }

    return filtered;
  }

  hasMultipleSignals(correction, context) {
    let signals = 0;
    
    // Signal 1: Domain match
    if (this.isDomainMatch(correction, context)) signals++;
    
    // Signal 2: Phonetic similarity
    if (this.isPhoneticallyClose(correction.original, correction.corrected)) signals++;
    
    // Signal 3: Common error pattern
    if (this.isCommonError(correction)) signals++;
    
    // Signal 4: Context frequency
    if (this.appearsInContext(correction.corrected, context)) signals++;

    return signals >= 2;
  }
}

// Frontend - User Preferences
function CorrectionSettings({ onUpdate }) {
  const [profile, setProfile] = useState('balanced');
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Correction Settings</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-2">Correction Profile</label>
          <select 
            value={profile}
            onChange={e => {
              setProfile(e.target.value);
              onUpdate({ profile: e.target.value });
            }}
            className="w-full bg-slate-700 rounded px-3 py-2"
          >
            <option value="conservative">Conservative (Most Accurate)</option>
            <option value="balanced">Balanced (Recommended)</option>
            <option value="aggressive">Aggressive (Fastest)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showLowConfidence}
            onChange={e => setShowLowConfidence(e.target.checked)}
            className="w-4 h-4"
          />
          <label className="text-sm">Show low confidence corrections</label>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-sm">
          <strong>Current Profile:</strong> {profile}
          <br />
          {profile === 'conservative' && 'Waits for strong evidence before correcting. Best for critical applications.'}
          {profile === 'balanced' && 'Good mix of speed and accuracy. Recommended for most use cases.'}
          {profile === 'aggressive' && 'Fast corrections but may have false positives. Good for casual use.'}
        </div>
      </div>
    </div>
  );
}
```

---

### 5. Export & Recording Features

**Amaç:** Transkripsiyonları kaydet, SRT/VTT formatında dışa aktar

```javascript
// Backend - Export Service
class ExportService {
  async exportToSRT(transcriptSegments) {
    let srt = '';
    
    transcriptSegments.forEach((seg, idx) => {
      srt += `${idx + 1}\n`;
      srt += `${this.formatSRTTime(seg.start)} --> ${this.formatSRTTime(seg.end)}\n`;
      srt += `${seg.text}\n\n`;
    });

    return srt;
  }

  formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
  }

  async exportToJSON(session) {
    return {
      sessionId: session.id,
      startTime: session.startTime,
      endTime: session.endTime,
      duration: session.duration,
      language: session.language,
      segments: session.segments.map(seg => ({
        start: seg.start,
        end: seg.end,
        speaker: seg.speaker,
        text: seg.text,
        corrected: seg.corrected,
        corrections: seg.corrections,
        translation: seg.translation,
        emotion: seg.emotion
      })),
      metadata: {
        totalWords: session.totalWords,
        totalCorrections: session.totalCorrections,
        averageConfidence: session.averageConfidence,
        topics: session.detectedTopics
      }
    };
  }

  async exportToPDF(session) {
    // Use a library like pdfkit or jsPDF
    const doc = new PDFDocument();
    
    doc.fontSize(20).text('Transcript Report', { align: 'center' });
    doc.fontSize(12).text(`Date: ${new Date(session.startTime).toLocaleDateString()}`);
    doc.text(`Duration: ${this.formatDuration(session.duration)}`);
    doc.moveDown();

    session.segments.forEach(seg => {
      doc.fontSize(10).text(`[${this.formatTime(seg.start)}] ${seg.speaker || 'Speaker'}:`);
      doc.fontSize(11).text(seg.text);
      
      if (seg.corrections.length > 0) {
        doc.fontSize(9).fillColor('green').text(
          `Corrections: ${seg.corrections.map(c => `${c.original}→${c.corrected}`).join(', ')}`
        );
        doc.fillColor('black');
      }
      
      doc.moveDown();
    });

    return doc;
  }
}

// Frontend - Export UI
function ExportDialog({ session, onClose }) {
  const [format, setFormat] = useState('json');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    
    const response = await fetch('/api/export', {
      method: 'POST',
      body: JSON.stringify({ sessionId: session.id, format })
    });

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${session.id}.${format}`;
    a.click();
    
    setExporting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Export Transcript</h2>
        
        <div className="space-y-3 mb-6">
          <button
            onClick={() => setFormat('json')}
            className={`w-full p-3 rounded-lg text-left ${format === 'json' ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <div className="font-semibold">JSON</div>
            <div className="text-sm text-gray-400">Complete data with metadata</div>
          </button>
          
          <button
            onClick={() => setFormat('srt')}
            className={`w-full p-3 rounded-lg text-left ${format === 'srt' ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <div className="font-semibold">SRT Subtitles</div>
            <div className="text-sm text-gray-400">For video editing software</div>
          </button>
          
          <button
            onClick={() => setFormat('pdf')}
            className={`w-full p-3 rounded-lg text-left ${format === 'pdf' ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <div className="font-semibold">PDF Report</div>
            <div className="text-sm text-gray-400">Formatted document</div>
          </button>

          <button
            onClick={() => setFormat('txt')}
            className={`w-full p-3 rounded-lg text-left ${format === 'txt' ? 'bg-blue-500' : 'bg-slate-700'}`}
          >
            <div className="font-semibold">Plain Text</div>
            <div className="text-sm text-gray-400">Simple text file</div>
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 py-2 rounded-lg font-semibold"
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 🔒 Security & Privacy

### 1. Audio Data Encryption

```javascript
// End-to-end encryption for audio streams
import crypto from 'crypto';

class SecureAudioStream {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.key = crypto.randomBytes(32);
    this.iv = crypto.randomBytes(16);
  }

  encryptAudioChunk(audioData) {
    const cipher = crypto.createCipheriv(this.algorithm, this.key, this.iv);
    
    let encrypted = cipher.update(audioData);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted.toString('base64'),
      authTag: authTag.toString('base64'),
      iv: this.iv.toString('base64')
    };
  }

  decryptAudioChunk(encryptedData, authTag, iv) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'base64')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let decrypted = decipher.update(Buffer.from(encryptedData, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }
}
```

### 2. Data Retention Policy

```javascript
// Auto-delete old transcripts
class DataRetentionManager {
  constructor() {
    this.retentionPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days
  }

  async cleanupOldSessions() {
    const cutoffDate = Date.now() - this.retentionPeriod;
    
    const oldSessions = await db.sessions.find({
      endTime: { $lt: cutoffDate },
      autoDelete: true
    });

    for (const session of oldSessions) {
      // Delete audio files
      await this.deleteAudioFiles(session.audioFiles);
      
      // Delete transcripts
      await db.transcripts.deleteMany({ sessionId: session.id });
      
      // Delete session
      await db.sessions.deleteOne({ _id: session._id });
      
      console.log(`Deleted session ${session.id} (age: ${Math.floor((Date.now() - session.endTime) / 86400000)} days)`);
    }
  }

  async scheduleCleanup() {
    // Run daily at 2 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        await this.cleanupOldSessions();
      }
    }, 60000); // Check every minute
  }
}
```

---

## 📊 Analytics & Monitoring

```javascript
// Real-time analytics dashboard
class AnalyticsService {
  constructor() {
    this.metrics = {
      totalSessions: 0,
      activeUsers: 0,
      averageSessionDuration: 0,
      totalTranscriptionTime: 0,
      correctionAccuracy: [],
      translationQuality: [],
      apiLatency: {
        realtime: [],
        correction: [],
        translation: []
      },
      errorRate: 0,
      costPerSession: []
    };
  }

  trackSession(session) {
    this.metrics.totalSessions++;
    this.metrics.averageSessionDuration = 
      (this.metrics.averageSessionDuration * (this.metrics.totalSessions - 1) + session.duration) / 
      this.metrics.totalSessions;
    
    this.metrics.correctionAccuracy.push(session.correctionAccuracy);
    this.metrics.translationQuality.push(session.translationQuality);
    this.metrics.costPerSession.push(this.calculateCost(session));
  }

  calculateCost(session) {
    // OpenAI pricing
    const realtimeApiCost = (session.audioMinutes / 60) * 0.06; // $0.06/min
    const gpt4oMiniCost = (session.correctionTokens / 1000000) * 0.150; // $0.15/1M tokens
    const gpt4oCost = (session.translationTokens / 1000000) * 2.50; // $2.50/1M tokens
    
    return realtimeApiCost + gpt4oMiniCost + gpt4oCost;
  }

  getMetricsSummary() {
    return {
      ...this.metrics,
      averageCorrectionAccuracy: this.average(this.metrics.correctionAccuracy),
      averageTranslationQuality: this.average(this.metrics.translationQuality),
      averageCost: this.average(this.metrics.costPerSession),
      averageLatency: {
        realtime: this.average(this.metrics.apiLatency.realtime),
        correction: this.average(this.metrics.apiLatency.correction),
        translation: this.average(this.metrics.apiLatency.translation)
      }
    };
  }

  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }
}
```

---

## 🚀 Performance Testing

```javascript
// Load testing script
import { WebSocket } from 'ws';

class LoadTester {
  async runLoadTest(concurrentUsers = 100, duration = 60000) {
    console.log(`Starting load test: ${concurrentUsers} users for ${duration}ms`);
    
    const connections = [];
    const metrics = {
      successfulConnections: 0,
      failedConnections: 0,
      totalMessages: 0,
      averageLatency: [],
      errors: []
    };

    // Spawn concurrent users
    for (let i = 0; i < concurrentUsers; i++) {
      const ws = new WebSocket('ws://localhost:3001');
      
      ws.on('open', () => {
        metrics.successfulConnections++;
        
        // Send test audio data
        const interval = setInterval(() => {
          const startTime = Date.now();
          
          ws.send(JSON.stringify({
            type: 'audio',
            audio: this.generateRandomAudio()
          }));
          
          metrics.totalMessages++;
        }, 1000);

        connections.push({ ws, interval });
      });

      ws.on('error', (error) => {
        metrics.failedConnections++;
        metrics.errors.push(error.message);
      });

      ws.on('message', (data) => {
        const latency = Date.now() - JSON.parse(data).timestamp;
        metrics.averageLatency.push(latency);
      });

      // Stagger connection attempts
      await this.delay(50);
    }

    // Run for specified duration
    await this.delay(duration);

    // Cleanup
    connections.forEach(({ ws, interval }) => {
      clearInterval(interval);
      ws.close();
    });

    // Calculate results
    console.log('Load Test Results:');
    console.log(`- Success Rate: ${(metrics.successfulConnections / concurrentUsers * 100).toFixed(2)}%`);
    console.log(`- Total Messages: ${metrics.totalMessages}`);
    console.log(`- Average Latency: ${this.average(metrics.averageLatency).toFixed(2)}ms`);
    console.log(`- Error Rate: ${(metrics.errors.length / metrics.totalMessages * 100).toFixed(2)}%`);

    return metrics;
  }

  generateRandomAudio() {
    // Generate dummy PCM16 audio data
    const buffer = Buffer.alloc(4096);
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] = Math.floor(Math.random() * 256);
    }
    return buffer.toString('base64');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  average(arr) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}

// Run test
const tester = new LoadTester();
tester.runLoadTest(100, 60000);
```

---

Bu advanced features ile uygulamanız **enterprise-grade** seviyeye ulaşacak! 🎉

Şimdi sana **cost optimization ve deployment strategies** hazırlayayım mı?