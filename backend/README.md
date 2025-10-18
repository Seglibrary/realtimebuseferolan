# 🚀 Real-time AI Translator - Backend

## 📋 Gereksinimler

- Node.js 18+ 
- npm veya yarn
- OpenAI API Key (gpt-4o-realtime-preview erişimi ile)

## 🔧 Kurulum

### 1. Paketleri yükle

```bash
npm install
```

### 2. Environment variables ayarla

```bash
# .env dosyası oluştur
cp env.example .env

# .env dosyasını düzenle
OPENAI_API_KEY=sk-your-key-here
PORT=3001
NODE_ENV=development
```

**ÖNEMLİ:** OpenAI API key'inizi https://platform.openai.com/api-keys adresinden alın.

### 3. Sunucuyu başlat

```bash
npm start
# veya development mode için
npm run dev
```

✅ Backend hazır! `http://localhost:3001` adresinde çalışıyor.

## 🔌 API Endpoints

### WebSocket Endpoint
- **URL:** `ws://localhost:3001`
- **Protocol:** WebSocket
- **Purpose:** Real-time audio streaming ve transcription

### HTTP Endpoints

#### Health Check
- **GET** `/health`
- **Response:**
```json
{
  "status": "ok",
  "activeSessions": 2,
  "uptime": 123.45
}
```

## 📡 WebSocket Messages

### Client → Server

#### Start Transcription
```json
{
  "type": "start"
}
```

#### Send Audio Data
```json
{
  "type": "audio",
  "audio": "base64-encoded-pcm16-data"
}
```

#### Request Translation
```json
{
  "type": "translate",
  "text": "Text to translate",
  "targetLanguage": "English"
}
```

#### Stop Transcription
```json
{
  "type": "stop"
}
```

### Server → Client

#### Status Update
```json
{
  "type": "status",
  "message": "Connected to transcription service"
}
```

#### Transcript
```json
{
  "type": "transcript",
  "data": {
    "text": "Transcribed text",
    "timestamp": 1234567890,
    "corrected": false
  }
}
```

#### Corrections
```json
{
  "type": "corrections",
  "data": {
    "topic": "sports",
    "corrections": [
      {
        "original": "NBC",
        "corrected": "NBA",
        "confidence": 0.95,
        "reason": "Basketball organization context"
      }
    ]
  }
}
```

#### Translation (Streaming)
```json
{
  "type": "translation",
  "data": {
    "text": "Translated text chunk",
    "language": "English",
    "partial": true
  }
}
```

#### Error
```json
{
  "type": "error",
  "message": "Error description"
}
```

## 🧠 AI Models Used

- **OpenAI Realtime API:** Real-time speech-to-text
- **GPT-4o-mini:** Context analysis ve entity correction
- **GPT-4o:** Translation

## 🔍 Debugging

### Enable Debug Logging
```bash
DEBUG=true npm start
```

### Check OpenAI API Connection
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Monitor WebSocket Connections
```bash
# Check if port is open
lsof -i :3001
```

## 🚀 Production Deployment

### Environment Variables
```bash
OPENAI_API_KEY=your_production_key
PORT=3001
NODE_ENV=production
```

### Process Manager (PM2)
```bash
npm install -g pm2
pm2 start server.js --name "realtime-translator"
pm2 save
pm2 startup
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### Metrics
- Active WebSocket sessions
- Transcription accuracy
- Translation latency
- API usage costs

## 🐛 Troubleshooting

### Common Issues

1. **"OpenAI API Key Invalid"**
   - Check API key format (should start with `sk-`)
   - Verify key has Realtime API access
   - Check account credits

2. **"WebSocket Connection Failed"**
   - Ensure backend is running on port 3001
   - Check firewall settings
   - Verify CORS configuration

3. **"No Transcription"**
   - Check audio format (PCM16, 24kHz)
   - Verify microphone permissions
   - Check OpenAI API status

4. **"Corrections Not Working"**
   - Ensure context buffer has enough data (50+ chars)
   - Check GPT-4o-mini model access
   - Verify confidence thresholds

## 📚 Additional Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [WebSocket API Guide](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Node.js WebSocket Library](https://github.com/websockets/ws)
