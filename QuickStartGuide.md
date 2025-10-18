# ⚡ Quick Start & Troubleshooting Guide

## 🚀 5-Minute Quick Start

### Prerequisites Check

```bash
# Check Node.js version (need 18+)
node --version
# v18.17.0 ✅

# Check npm
npm --version
# 9.6.7 ✅

# Check if ports are available
lsof -i :3001  # Backend port
lsof -i :5173  # Frontend port
```

### Step-by-Step Setup

```bash
# 1. Create project structure
mkdir realtime-translator
cd realtime-translator
mkdir backend frontend

# 2. Setup Backend
cd backend
npm init -y
npm install express ws openai cors dotenv

# 3. Create .env file
cat > .env << EOF
OPENAI_API_KEY=sk-your-key-here
PORT=3001
NODE_ENV=development
EOF

# 4. Copy server.js from artifacts
# (Use the backend artifact code)

# 5. Start backend
node server.js
# 🚀 Server running on http://localhost:3001

# 6. Setup Frontend (new terminal)
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install lucide-react

# 7. Copy App.jsx from artifacts
# (Use the frontend artifact code)

# 8. Start frontend
npm run dev
# ➜ Local: http://localhost:5173

# 9. Open browser
open http://localhost:5173
```

**Total time: ~5 minutes** ⚡

---

## 🔧 Common Issues & Solutions

### Issue 1: "OpenAI API Key Invalid"

**Symptom:**
```
❌ Failed to connect to Realtime API: 401 Unauthorized
```

**Solution:**
```bash
# 1. Check if key is set
echo $OPENAI_API_KEY

# 2. Verify key format
# Should start with: sk-proj-... or sk-...

# 3. Check key permissions
# Go to: https://platform.openai.com/api-keys
# Ensure key has "Realtime API" access

# 4. Test key manually
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# 5. Regenerate if needed
```

---

### Issue 2: "WebSocket Connection Failed"

**Symptom:**
```
🔌 Disconnected from server
Connection error
```

**Solution:**

```javascript
// Debug WebSocket connection
const ws = new WebSocket('ws://localhost:3001');

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  
  // Common causes:
  // 1. Backend not running
  // 2. Wrong port
  // 3. Firewall blocking
  // 4. CORS issue
};

// Fix 1: Ensure backend is running
// Terminal: cd backend && node server.js

// Fix 2: Check backend logs
// Look for: "🚀 Server running on..."

// Fix 3: Try different port
// In .env: PORT=3002
// In frontend: ws://localhost:3002

// Fix 4: Check firewall
// Mac: System Preferences → Security → Firewall
// Windows: Windows Defender Firewall
```

---

### Issue 3: "Microphone Not Working"

**Symptom:**
```
Microphone access denied
No audio detected
```

**Solution:**

```javascript
// Check browser permissions
navigator.permissions.query({ name: 'microphone' })
  .then(result => {
    console.log('Microphone permission:', result.state);
    // granted / denied / prompt
  });

// Reset permissions:
// Chrome: chrome://settings/content/microphone
// Firefox: about:preferences#privacy
// Edge: edge://settings/content/microphone

// Manual test
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✅ Microphone working!');
    stream.getTracks().forEach(track => track.stop());
  })
  .catch(error => {
    console.error('❌ Microphone error:', error);
    // Common errors:
    // NotAllowedError: Permission denied
    // NotFoundError: No microphone found
    // NotReadableError: Hardware error
  });

// Solutions:
// 1. Allow permission in browser popup
// 2. Check system settings
// 3. Try different browser
// 4. Restart browser
// 5. Check if other apps using mic
```

---

### Issue 4: "No Transcription Appearing"

**Symptom:**
```
Recording... (but no text shows up)
```

**Debug Steps:**

```javascript
// 1. Check backend logs
// Look for: "📝 Transcript: ..."

// 2. Check WebSocket messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data.type, data);
};

// 3. Verify audio is being sent
// Backend should log: "Received audio chunk"

// 4. Check audio format
// Should be: PCM16, 24kHz, Mono

// 5. Test with simple phrase
// Speak clearly: "Hello, this is a test"

// 6. Check Realtime API status
// https://status.openai.com/

// Common fixes:
// - Speak louder
// - Move closer to mic
// - Reduce background noise
// - Wait 2-3 seconds for processing
// - Check API quotas
```

---

### Issue 5: "Corrections Not Working"

**Symptom:**
```
Transcript appears but no corrections
```

**Debug:**

```javascript
// 1. Check context buffer
console.log('Context buffer size:', session.contextBuffer.length);
// Should have at least 3-5 entries

// 2. Check analysis trigger
// Should trigger every 5 seconds
console.log('Last analysis:', Date.now() - session.lastAnalysisTime);

// 3. Manual test
const testTranscript = "NBC tarafından MVW ödülü verildi";
const testContext = "basketbol maçı final serisi oyuncu takım";

session.analyzeAndCorrect(testTranscript, testContext)
  .then(corrections => {
    console.log('Corrections:', corrections);
    // Should return: NBC→NBA, MVW→MVP
  });

// 4. Check GPT-4o-mini response
// Look for JSON parsing errors

// 5. Verify confidence threshold
// Lower if needed: minConfidence = 0.7 (from 0.85)
```

---

### Issue 6: "Translation Too Slow"

**Symptom:**
```
Transcription works but translation lags
```

**Optimizations:**

```javascript
// 1. Use streaming translation
async function streamTranslation(text, targetLang) {
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `Translate to ${targetLang}` },
      { role: 'user', content: text }
    ],
    stream: true,
    max_tokens: 500  // Add limit
  });

  for await (const chunk of stream) {
    // Send immediately, don't wait for complete
    emitPartialTranslation(chunk);
  }
}

// 2. Reduce context size
const shortContext = context.slice(-500); // Only last 500 chars

// 3. Use faster model for simple text
if (text.length < 50) {
  model = 'gpt-4o-mini'; // Faster & cheaper
}

// 4. Implement debouncing
const debouncedTranslate = debounce(translate, 1500);

// 5. Parallel processing
Promise.all([
  correctEntities(text),
  translateText(text)
]);
```

---

## 🐛 Advanced Debugging

### Enable Verbose Logging

```javascript
// Backend - server.js
const DEBUG = process.env.DEBUG === 'true';

function log(level, message, data = {}) {
  if (!DEBUG && level === 'debug') return;
  
  const timestamp = new Date().toISOString();
  const emoji = {
    info: 'ℹ️',
    warn: '⚠️',
    error: '❌',
    debug: '🔍',
    success: '✅'
  }[level];
  
  console.log(`${emoji} [${timestamp}] ${message}`, 
    Object.keys(data).length ? data : '');
}

// Usage
log('debug', 'Audio chunk received', { size: audioData.length });
log('info', 'Correction analysis complete', { corrections: result.length });
log('error', 'Translation failed', { error: error.message });
```

### Performance Profiling

```javascript
// Measure execution time
class PerformanceMonitor {
  timers = new Map();
  
  start(label) {
    this.timers.set(label, Date.now());
  }
  
  end(label) {
    const start = this.timers.get(label);
    if (!start) return;
    
    const duration = Date.now() - start;
    console.log(`⏱️ ${label}: ${duration}ms`);
    
    if (duration > 1000) {
      console.warn(`⚠️ ${label} took ${duration}ms (slow!)`);
    }
    
    this.timers.delete(label);
    return duration;
  }
}

// Usage
const perf = new PerformanceMonitor();

perf.start('transcription');
await transcribeAudio(audioData);
perf.end('transcription');

perf.start('correction');
await correctEntities(text, context);
perf.end('correction');

perf.start('translation');
await translateText(text, targetLang);
perf.end('translation');
```

### Memory Leak Detection

```javascript
// Monitor memory usage
setInterval(() => {
  const usage = process.memoryUsage();
  
  console.log('Memory Usage:');
  console.log(`- RSS: ${(usage.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- Heap: ${(usage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`- External: ${(usage.external / 1024 / 1024).toFixed(2)} MB`);
  
  // Alert if memory usage is high
  if (usage.heapUsed / 1024 / 1024 > 500) {
    console.warn('⚠️ High memory usage detected!');
    // Trigger garbage collection if needed
    if (global.gc) global.gc();
  }
}, 30000); // Check every 30 seconds

// Detect memory leaks
const sessions = new Map();
const MAX_SESSIONS = 1000;

function cleanupOldSessions() {
  if (sessions.size > MAX_SESSIONS) {
    console.warn(`⚠️ Too many sessions: ${sessions.size}`);
    
    // Remove oldest sessions
    const oldSessions = Array.from(sessions.entries())
      .sort((a, b) => a[1].lastActivity - b[1].lastActivity)
      .slice(0, 100);
    
    oldSessions.forEach(([id]) => {
      console.log(`🗑️ Cleaning up session ${id}`);
      sessions.get(id).disconnect();
      sessions.delete(id);
    });
  }
}

setInterval(cleanupOldSessions, 60000); // Every minute
```

---

## 📊 Health Check Endpoints

```javascript
// Backend - Add monitoring endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeSessions: sessions.size
  });
});

app.get('/metrics', (req, res) => {
  res.json({
    sessions: {
      total: metrics.totalSessions,
      active: sessions.size,
      averageDuration: metrics.averageSessionDuration
    },
    api: {
      transcriptionLatency: metrics.transcriptionLatency,
      correctionLatency: metrics.correctionLatency,
      translationLatency: metrics.translationLatency,
      errorRate: metrics.errorRate
    },
    costs: {
      totalSpent: metrics.totalCost,
      averagePerSession: metrics.averageCostPerSession,
      projectedMonthly: metrics.projectedMonthlyCost
    }
  });
});

app.get('/ready', (req, res) => {
  // Check if all dependencies are available
  const checks = {
    openai: checkOpenAIConnection(),
    redis: checkRedisConnection(),
    database: checkDatabaseConnection()
  };
  
  const allHealthy = Object.values(checks).every(c => c === true);
  
  res.status(allHealthy ? 200 : 503).json({
    ready: allHealthy,
    checks
  });
});
```

---

## 🧪 Testing Guide

### Unit Tests

```javascript
// tests/correction.test.js
import { describe, it, expect } from 'vitest';
import { CorrectionEngine } from '../src/correction-engine.js';

describe('CorrectionEngine', () => {
  const engine = new CorrectionEngine();
  
  it('should correct NBA homophone', async () => {
    const text = "NBC tarafından MVW ödülü verildi";
    const context = "basketbol maçı final oyuncu takım";
    
    const corrections = await engine.correct(text, context);
    
    expect(corrections).toContainEqual({
      original: 'NBC',
      corrected: 'NBA',
      confidence: expect.any(Number)
    });
    
    expect(corrections).toContainEqual({
      original: 'MVW',
      corrected: 'MVP',
      confidence: expect.any(Number)
    });
  });
  
  it('should not correct RNA in biology context', async () => {
    const text = "RNA polimeraz enzimi";
    const context = "hücre DNA molekül gen protein";
    
    const corrections = await engine.correct(text, context);
    
    const rnaCorrection = corrections.find(c => c.original === 'RNA');
    expect(rnaCorrection).toBeUndefined();
  });
  
  it('should handle context switch', async () => {
    const text1 = "NBA final serisinde";
    const context1 = "basketbol";
    
    const text2 = "RNA molekülü";
    const context2 = "basketbol... ve şimdi biyoloji dersi";
    
    // First correction
    const corrections1 = await engine.correct(text1, context1);
    expect(corrections1).toHaveLength(0); // NBA is correct
    
    // Second correction
    const corrections2 = await engine.correct(text2, context2);
    expect(corrections2).toHaveLength(0); // RNA is correct in new context
  });
});
```

### Integration Tests

```javascript
// tests/integration.test.js
import { WebSocket } from 'ws';

describe('WebSocket Integration', () => {
  let ws;
  
  beforeEach(() => {
    ws = new WebSocket('ws://localhost:3001');
    return new Promise(resolve => {
      ws.on('open', resolve);
    });
  });
  
  afterEach(() => {
    ws.close();
  });
  
  it('should handle full transcription flow', async () => {
    const messages = [];
    
    ws.on('message', (data) => {
      messages.push(JSON.parse(data));
    });
    
    // Start transcription
    ws.send(JSON.stringify({ type: 'start' }));
    
    // Send audio data
    const audioData = generateTestAudio("Hello world");
    ws.send(JSON.stringify({ type: 'audio', audio: audioData }));
    
    // Wait for transcript
    await waitFor(() => messages.some(m => m.type === 'transcript'));
    
    const transcript = messages.find(m => m.type === 'transcript');
    expect(transcript.data.text).toContain('Hello');
  });
});
```

### Load Testing

```javascript
// tests/load.test.js
import { check } from 'k6';
import ws from 'k6/ws';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
};

export default function () {
  const url = 'ws://localhost:3001';
  
  const response = ws.connect(url, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({ type: 'start' }));
    });
    
    socket.on('message', (data) => {
      const message = JSON.parse(data);
      check(message, {
        'has type': (m) => m.type !== undefined,
        'no errors': (m) => m.type !== 'error',
      });
    });
    
    socket.on('error', (e) => {
      errorRate.add(1);
      console.error(e);
    });
    
    // Send test audio every second
    const interval = setInterval(() => {
      socket.send(JSON.stringify({
        type: 'audio',
        audio: generateTestAudio()
      }));
    }, 1000);
    
    // Close after 30 seconds
    setTimeout(() => {
      clearInterval(interval);
      socket.close();
    }, 30000);
  });
  
  check(response, { 'connected': (r) => r && r.status === 101 });
}
```

---

## 🔐 Security Best Practices

### 1. API Key Security

```javascript
// ❌ NEVER do this
const OPENAI_API_KEY = 'sk-proj-abc123...'; // Hardcoded!

// ✅ Always use environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ✅ Validate on startup
if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not set!');
  process.exit(1);
}

// ✅ Use secrets manager in production
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getApiKey() {
  const client = new SecretsManagerClient({ region: 'us-east-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: 'openai-api-key' })
  );
  return JSON.parse(response.SecretString).OPENAI_API_KEY;
}
```

### 2. Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

// Global rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later.'
});

app.use(globalLimiter);

// Per-user rate limit
const userLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per user
  keyGenerator: (req) => req.user?.id || req.ip
});

app.use('/api/', userLimiter);

// WebSocket rate limiting
class WebSocketRateLimiter {
  constructor() {
    this.clients = new Map();
    this.maxMessagesPerMinute = 60;
  }
  
  checkLimit(clientId) {
    const now = Date.now();
    const client = this.clients.get(clientId) || { count: 0, resetTime: now + 60000 };
    
    if (now > client.resetTime) {
      client.count = 0;
      client.resetTime = now + 60000;
    }
    
    client.count++;
    this.clients.set(clientId, client);
    
    if (client.count > this.maxMessagesPerMinute) {
      throw new Error('Rate limit exceeded');
    }
  }
}
```

### 3. Input Validation

```javascript
import { z } from 'zod';

// Define schemas
const AudioMessageSchema = z.object({
  type: z.literal('audio'),
  audio: z.string().base64(),
});

const TranslateMessageSchema = z.object({
  type: z.literal('translate'),
  text: z.string().min(1).max(5000),
  targetLanguage: z.enum(['English', 'Turkish', 'Spanish', 'German', 'French']),
});

// Validate incoming messages
ws.on('message', (data) => {
  try {
    const message = JSON.parse(data);
    
    if (message.type === 'audio') {
      const validated = AudioMessageSchema.parse(message);
      handleAudio(validated);
    } else if (message.type === 'translate') {
      const validated = TranslateMessageSchema.parse(message);
      handleTranslation(validated);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        errors: error.errors
      }));
    }
  }
});
```

### 4. CORS Configuration

```javascript
import cors from 'cors';

// Development
if (process.env.NODE_ENV === 'development') {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
  }));
}

// Production
if (process.env.NODE_ENV === 'production') {
  app.use(cors({
    origin: [
      'https://yourdomain.com',
      'https://www.yourdomain.com'
    ],
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
}
```

---

## 📱 Browser Compatibility

### Supported Browsers

```
✅ Chrome 90+ (Recommended)
✅ Edge 90+
✅ Firefox 88+
✅ Safari 14+
⚠️ Opera 76+ (Limited testing)
❌ IE 11 (Not supported)
```

### Feature Detection

```javascript
// Check browser capabilities
function checkBrowserSupport() {
  const features = {
    webSocket: 'WebSocket' in window,
    webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
    mediaDevices: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
    promises: 'Promise' in window,
    fetch: 'fetch' in window
  };
  
  const unsupported = Object.entries(features)
    .filter(([, supported]) => !supported)
    .map(([feature]) => feature);
  
  if (unsupported.length > 0) {
    alert(`Your browser doesn't support: ${unsupported.join(', ')}\n\nPlease use Chrome, Edge, or Firefox.`);
    return false;
  }
  
  return true;
}

// Run on page load
if (!checkBrowserSupport()) {
  document.body.innerHTML = '<div style="padding: 20px; text-align: center;"><h1>Browser Not Supported</h1><p>Please use a modern browser like Chrome, Edge, or Firefox.</p></div>';
}
```

---

## 🎓 Learning Resources

### Documentation
- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [WebSocket API Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

### Example Prompts

```javascript
// Good prompts for correction
const goodPrompts = [
  "Uluslararası basketbol organizasyonu NBC",
  "Biyoloji dersinde RNA molekülü",
  "Yılın en değerli oyuncusu MVW ödülü",
  "Lebron Harden maçın yıldızı"
];

// Complex scenarios
const complexScenarios = [
  "NBA maçından sonra RNA hakkında konuştuk", // Context switch
  "DNA ve NBA'in ortak noktası yok", // Mixed context
  "MVW ödülü kazanan oyuncu MVP seçildi" // Same error twice
];
```

---

## 💡 Pro Tips

### 1. Optimize Audio Quality

```javascript
// Use higher quality audio for better transcription
const audioConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 24000,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

navigator.mediaDevices.getUserMedia(audioConstraints);
```

### 2. Batch Similar Requests

```javascript
// Instead of translating each sentence individually
// ❌ Bad
for (const sentence of sentences) {
  await translate(sentence);
}

// ✅ Good
const combined = sentences.join('\n');
const translated = await translate(combined);
const results = translated.split('\n');
```

### 3. Use Webhooks for Long Operations

```javascript
// For very long transcriptions, use async processing
app.post('/transcribe-async', async (req, res) => {
  const jobId = generateJobId();
  
  // Return immediately
  res.json({ jobId, status: 'processing' });
  
  // Process in background
  processTranscription(req.body.audio).then(result => {
    // Notify via webhook
    fetch(req.body.webhookUrl, {
      method: 'POST',
      body: JSON.stringify({ jobId, result })
    });
  });
});
```

### 4. Implement Retry Logic

```javascript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
      await sleep(delay);
    }
  }
}

// Usage
const result = await retryWithBackoff(() => 
  openai.chat.completions.create(params)
);
```

---

## 🎯 Next Steps

### After Basic Setup
1. ✅ Test with different languages
2. ✅ Add custom dictionary for your domain
3. ✅ Implement user authentication
4. ✅ Set up monitoring (DataDog/Sentry)
5. ✅ Deploy to staging environment

### Before Production
1. ✅ Complete security audit
2. ✅ Load testing with 100+ users
3. ✅ Set up CI/CD pipeline
4. ✅ Configure auto-scaling
5. ✅ Implement cost alerts
6. ✅ Create user documentation
7. ✅ Set up customer support

### Growth Phase
1. ✅ A/B test new features
2. ✅ Optimize based on analytics
3. ✅ Add premium features
4. ✅ Implement referral system
5. ✅ Expand to mobile app

---

## 📞 Support Contacts

```
🐛 Bug Reports: github.com/yourproject/issues
💬 Community: discord.gg/yourproject
📧 Email: support@yourproject.com
📚 Docs: docs.yourproject.com
```

---

**Artık her şey hazır! 🎉 Başarılar!**