# 🚀 Real-time AI Translator - Kurulum Rehberi

## 📋 Gereksinimler

- Node.js 18+ 
- npm veya yarn
- OpenAI API Key (gpt-4o-realtime-preview erişimi ile)
- Modern web browser (Chrome/Edge önerilir)

---

## 📁 Proje Yapısı

```
realtime-translator/
├── backend/
│   ├── server.js
│   ├── package.json
│   └── .env
└── frontend/
    ├── src/
    │   └── App.jsx
    ├── package.json
    └── index.html
```

---

## 🔧 BACKEND KURULUMU

### 1. Backend klasörü oluştur ve dosyaları yerleştir

```bash
mkdir -p realtime-translator/backend
cd realtime-translator/backend
```

### 2. package.json oluştur

```json
{
  "name": "realtime-translator-backend",
  "version": "1.0.0",
  "type": "module",
  "description": "Real-time AI translation backend with context-aware correction",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "openai": "^4.20.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 3. .env dosyası oluştur

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

**ÖNEMLİ:** OpenAI API key'inizi https://platform.openai.com/api-keys adresinden alın.

### 4. Paketleri yükle

```bash
npm install
```

### 5. Sunucuyu başlat

```bash
npm start
# veya development mode için
npm run dev
```

✅ Backend hazır! `http://localhost:3001` adresinde çalışıyor.

---

## 💻 FRONTEND KURULUMU

### 1. Frontend klasörü oluştur

```bash
cd ..
mkdir frontend
cd frontend
```

### 2. Vite + React projesi oluştur

```bash
npm create vite@latest . -- --template react
```

### 3. Gerekli paketleri yükle

```bash
npm install lucide-react
```

### 4. package.json'a ekle (varsa eklenecek)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.263.1"
  }
}
```

### 5. src/App.jsx dosyasını değiştir

Artifact'taki React kodunu buraya kopyala.

### 6. Frontend'i başlat

```bash
npm run dev
```

✅ Frontend hazır! `http://localhost:5173` adresinde çalışıyor.

---

## 🎯 ÇALIŞTIRMA

### Terminal 1 - Backend
```bash
cd backend
npm start
```

### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

### Tarayıcıda aç
```
http://localhost:5173
```

---

## 🔍 ÖNEMLİ NOTLAR

### OpenAI Realtime API Erişimi

**GÜNCELLEME:** OpenAI Realtime API şu anda preview aşamasında ve özel erişim gerektirebilir. Eğer erişiminiz yoksa:

**ALTERNATIF YAKLAŞIM:**

Backend'de Realtime API yerine **Whisper API + Streaming** kullanabilirsiniz:

```javascript
// server.js'de değişiklik
// OpenAI Realtime API yerine:

async function transcribeAudioChunk(audioBuffer) {
  const response = await openai.audio.transcriptions.create({
    file: audioBuffer,
    model: "whisper-1",
    language: "tr", // veya auto-detect için boş bırak
  });
  
  return response.text;
}
```

### Mikrofon İzinleri

- İlk kullanımda tarayıcı mikrofon izni isteyecek
- Chrome/Edge önerilir (daha iyi ses desteği)
- HTTPS gerekli (production için)

### Audio Format

- Sample Rate: 24kHz (OpenAI Realtime API requirement)
- Format: PCM16
- Channels: Mono

---

## 🧪 TEST SENARYOLARI

### 1. Basketbol Testi
```
Konuş: "Uluslararası basketbol kuruluşu NBC tarafından yılın en iyi oyuncusu MVW ödülü Lebron Harden adlı oyuncuya verildi."

Beklenen Düzeltme: NBC → NBA, MVW → MVP, Lebron Harden → LeBron James
```

### 2. Biyoloji Testi
```
Konuş: "DNA ve RNA molekülleri hücrenin genetik bilgisini taşır..."

Beklenen: RNA kelimesi NBA olarak değil RNA olarak kalmalı (bağlam gereği)
```

### 3. Konu Değişikliği Testi
```
Önce: "NBA final serisinde Lakers kazandı..."
Sonra: "RNA polimeraz enzimi..."

Beklenen: İlk başta NBA → sonra RNA olarak düzelmeli
```

---

## 🐛 Sorun Giderme

### "WebSocket connection failed"
- Backend'in çalıştığından emin ol (`npm start`)
- Port 3001'in açık olduğunu kontrol et

### "Microphone access denied"
- Tarayıcı ayarlarından mikrofon iznini kontrol et
- HTTPS kullan (production)

### "OpenAI API error"
- API key'in doğru olduğundan emin ol
- Hesabında kredi olduğunu kontrol et
- Realtime API erişiminiz var mı kontrol et

### "Corrections not working"
- GPT-4o-mini model erişiminiz olduğundan emin ol
- Context buffer'ın dolması için en az 10-15 saniye konuş
- Console logları kontrol et

---

## 🚀 PRODUCTION DEPLOYMENT

### Backend (Örnek: Railway/Render)

```bash
# Environment variables
OPENAI_API_KEY=your_key
PORT=3001
NODE_ENV=production
```

### Frontend (Örnek: Vercel/Netlify)

WebSocket URL'ini güncelle:
```javascript
const ws = new WebSocket('wss://your-backend.com');
```

### HTTPS Gereksinimi
Production'da mutlaka HTTPS kullan:
- Backend için SSL sertifikası
- Frontend için otomatik (Vercel/Netlify)

---

## 📊 Performans Optimizasyonu

### 1. Context Window Ayarı
```javascript
// server.js'de
const CONTEXT_WINDOW = 60; // saniye (daha az = daha hızlı)
const ANALYSIS_TRIGGER = 5; // saniye (daha sık = daha doğru)
```

### 2. Düzeltme Agresifliği
```javascript
// Confidence threshold
if (correction.confidence > 0.85) {
  // Yüksek güven = hemen düzelt
}
```

### 3. Audio Buffer Size
```javascript
// Frontend - daha küçük buffer = daha hızlı
const processor = audioContext.createScriptProcessor(2048, 1, 1);
```

---

## 🎨 Özelleştirme

### Dil Ekleme
```javascript
// Frontend
<option>Italian</option>
<option>Arabic</option>
```

### Tema Değiştirme
```javascript
// Tailwind class'larını değiştir
className="bg-gradient-to-br from-blue-900..."
```

### Correction Rules
```javascript
// Backend - domain-specific rules ekle
const customRules = {
  medical: ['MRİ' → 'MRI', 'DNA' → 'DNA'],
  sports: ['NBA', 'FIFA', 'UEFA'],
};
```

---

## 📚 Gelişmiş Özellikler (Roadmap)

- [ ] Multi-speaker diarization
- [ ] Emotion detection
- [ ] Custom domain dictionaries
- [ ] Offline mode (WebGPU)
- [ ] Mobile app (React Native)
- [ ] Real-time collaboration
- [ ] Recording export (SRT, VTT)
- [ ] Fine-tuned correction models

---

## 🤝 Katkıda Bulunma

Bu açık kaynak projedir! Geliştirmeler için:

1. Fork yap
2. Feature branch oluştur
3. Commit yap
4. Pull request aç

---

## 📄 Lisans

MIT License - Ticari ve kişisel kullanım için ücretsiz.

---

## 💬 Destek

Sorular için:
- GitHub Issues
- Email: support@example.com
- Discord: [link]

---

**Başarılar! 🎉**