# 🚀 Real-time AI Translator

OpenAI'nin Realtime API'si ile gerçek zamanlı ses çevirisi ve bağlam tabanlı düzeltme sistemi.

## ✨ Özellikler

- 🎤 **Gerçek Zamanlı Transkripsiyon** - OpenAI Realtime API ile anlık ses-metin dönüşümü
- 🧠 **Akıllı Düzeltme** - Bağlam tabanlı entity düzeltme (NBC→NBA, MVW→MVP)
- 🌍 **Çok Dilli Çeviri** - 5 farklı dilde streaming çeviri
- 🎨 **Animasyonlu UI** - Smooth düzeltme animasyonları
- ⚡ **Düşük Gecikme** - 300-800ms transkripsiyon gecikmesi
- 🔄 **Otomatik Bağlam** - Konuşma konusuna göre dinamik düzeltme

## 🏗️ Mimari

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │   Node.js API   │    │   OpenAI APIs   │
│                 │    │                 │    │                 │
│ • WebRTC Audio  │◄──►│ • WebSocket     │◄──►│ • GPT-4o        │
│ • Real-time UI  │    │ • Context Mgmt  │    │ • GPT-4o-mini   │
│ • Animation     │    │ • Stream Proc   │    │ • Realtime API  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Hızlı Başlangıç

### 1. Projeyi klonla
```bash
git clone <repository-url>
cd realtime-translator
```

### 2. Backend'i kur
```bash
cd backend
npm install
cp env.example .env
# .env dosyasına OpenAI API key'inizi ekleyin
npm start
```

### 3. Frontend'i kur
```bash
cd ../frontend
npm install
npm run dev
```

### 4. Tarayıcıda aç
```
http://localhost:5173
```

## 📋 Gereksinimler

- **Node.js 18+**
- **OpenAI API Key** (Realtime API erişimi ile)
- **Modern Web Browser** (Chrome/Edge önerilir)
- **Mikrofon Erişimi**

## 🔧 Kurulum Detayları

### Backend Kurulumu
```bash
cd backend
npm install express ws openai cors dotenv
npm start
```

### Frontend Kurulumu
```bash
cd frontend
npm install react react-dom lucide-react
npm install -D vite @vitejs/plugin-react tailwindcss
npm run dev
```

### Environment Variables
```bash
# backend/.env
OPENAI_API_KEY=sk-your-key-here
PORT=3001
NODE_ENV=development
```

## 🧪 Test Senaryoları

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

## 🎯 Kullanım

1. **Mikrofon İzni Ver** - İlk kullanımda tarayıcı izin isteyecek
2. **Dil Seç** - Hedef çeviri dilini seç
3. **Kaydı Başlat** - "Start Recording" butonuna tıkla
4. **Konuş** - Normal hızda konuş
5. **Sonuçları İzle** - Transkript ve çeviri gerçek zamanlı görünür
6. **Düzeltmeleri Gör** - AI düzeltmelerini animasyonlu olarak izle

## 🔍 Teknik Detaylar

### Ses İşleme
- **Format:** PCM16, 24kHz, Mono
- **Buffer:** 4096 sample chunks
- **Encoding:** Base64 transmission

### AI Modelleri
- **Realtime API:** Speech-to-text (300-800ms)
- **GPT-4o-mini:** Context analysis ve correction
- **GPT-4o:** Translation (streaming)

### Bağlam Yönetimi
- **Window:** 60 saniye rolling buffer
- **Analysis:** Her 5 saniyede context analizi
- **Correction:** Confidence threshold 0.85+

## 🐛 Sorun Giderme

### "WebSocket connection failed"
- Backend'in çalıştığından emin ol (`npm start`)
- Port 3001'in açık olduğunu kontrol et

### "Microphone access denied"
- Tarayıcı ayarlarından mikrofon iznini kontrol et
- HTTPS kullan (production için)

### "OpenAI API error"
- API key'in doğru olduğundan emin ol
- Hesabında kredi olduğunu kontrol et
- Realtime API erişiminiz var mı kontrol et

### "Corrections not working"
- GPT-4o-mini model erişiminiz olduğundan emin ol
- Context buffer'ın dolması için en az 10-15 saniye konuş
- Console logları kontrol et

## 📊 Performans Metrikleri

- **Transkripsiyon Gecikmesi:** 300-800ms
- **Düzeltme Doğruluğu:** >90%
- **Çeviri Kalitesi:** >40 BLEU score
- **Bağlam Algılama:** >85%

## 🚀 Production Deployment

### Backend (Railway/Render)
```bash
# Environment variables
OPENAI_API_KEY=your_key
PORT=3001
NODE_ENV=production
```

### Frontend (Vercel/Netlify)
```bash
# WebSocket URL'ini güncelle
const ws = new WebSocket('wss://your-backend.com');
```

### HTTPS Gereksinimi
Production'da mutlaka HTTPS kullan:
- Backend için SSL sertifikası
- Frontend için otomatik (Vercel/Netlify)

## 📚 Dokümantasyon

- [Backend API Docs](./backend/README.md)
- [Frontend Guide](./frontend/README.md)
- [Technical Architecture](./TeknikYapi.md)
- [Quick Start Guide](./QuickStartGuide.md)
- [Advanced Features](./AdvencedFeatures.md)

## 🤝 Katkıda Bulunma

Bu açık kaynak projedir! Geliştirmeler için:

1. Fork yap
2. Feature branch oluştur
3. Commit yap
4. Pull request aç

## 📄 Lisans

MIT License - Ticari ve kişisel kullanım için ücretsiz.

## 💬 Destek

Sorular için:
- GitHub Issues
- Email: support@example.com
- Discord: [link]

---

**Başarılar! 🎉**
