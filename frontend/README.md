# 🎨 Real-time AI Translator - Frontend

## 📋 Gereksinimler

- Node.js 18+
- Modern web browser (Chrome/Edge önerilir)
- Mikrofon erişimi

## 🔧 Kurulum

### 1. Paketleri yükle

```bash
npm install
```

### 2. Development server'ı başlat

```bash
npm run dev
```

✅ Frontend hazır! `http://localhost:5173` adresinde çalışıyor.

## 🎯 Özellikler

### Real-time Audio Processing
- **Sample Rate:** 24kHz
- **Format:** PCM16
- **Channels:** Mono
- **Buffer Size:** 4096 samples

### WebSocket Communication
- **Backend URL:** `ws://localhost:3001`
- **Protocol:** WebSocket
- **Auto-reconnection:** Yes

### UI Components

#### Main Interface
- **Header:** App title ve description
- **Status Bar:** Connection status, topic detection, language selector
- **Transcript Panel:** Real-time speech-to-text display
- **Translation Panel:** Multi-language translation
- **Control Buttons:** Start/Stop recording, Clear all

#### Transcript Item
- **Animation:** Smooth correction transitions
- **Correction Display:** Shows original → corrected
- **Timestamp:** Real-time timestamps
- **Visual Feedback:** Color-coded correction states

### Supported Languages
- English
- Turkish
- Spanish
- German
- French

## 🎨 Styling

### Tailwind CSS
- **Theme:** Dark mode with gradients
- **Colors:** Slate/Purple gradient background
- **Animations:** Pulse, bounce, scale effects
- **Responsive:** Mobile-friendly design

### Custom CSS
- **Correction Animations:** Fade → Morph → Highlight
- **Custom Scrollbar:** Styled for dark theme
- **Focus States:** Purple outline for accessibility

## 🔧 Configuration

### Audio Settings
```javascript
const audioConstraints = {
  audio: {
    channelCount: 1,
    sampleRate: 24000,
    echoCancellation: true,
    noiseSuppression: true,
  }
};
```

### WebSocket Settings
```javascript
const wsUrl = 'ws://localhost:3001';
const reconnectInterval = 5000;
const maxReconnectAttempts = 10;
```

## 🚀 Build & Deploy

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

### Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Update WebSocket URL for production
# Change ws://localhost:3001 to wss://your-backend.com
```

## 🧪 Testing

### Browser Compatibility
- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ Opera 76+ (Limited testing)

### Feature Detection
```javascript
// Check browser capabilities
function checkBrowserSupport() {
  const features = {
    webSocket: 'WebSocket' in window,
    webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
    mediaDevices: navigator.mediaDevices && navigator.mediaDevices.getUserMedia,
  };
  
  return Object.values(features).every(supported => supported);
}
```

## 🐛 Troubleshooting

### Common Issues

1. **"Microphone access denied"**
   - Allow microphone permission in browser
   - Check system microphone settings
   - Try different browser

2. **"WebSocket connection failed"**
   - Ensure backend is running on port 3001
   - Check network connectivity
   - Verify CORS settings

3. **"No audio detected"**
   - Check microphone hardware
   - Verify audio input levels
   - Test with different applications

4. **"Translation not working"**
   - Check backend connection
   - Verify language selection
   - Check console for errors

### Debug Mode
```javascript
// Enable debug logging
localStorage.setItem('debug', 'true');

// Check WebSocket connection
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (error) => console.error('❌ WebSocket error:', error);
ws.onclose = () => console.log('🔌 WebSocket disconnected');
```

## 📱 Mobile Support

### Responsive Design
- **Mobile-first:** Optimized for small screens
- **Touch-friendly:** Large buttons and touch targets
- **Portrait/Landscape:** Works in both orientations

### Mobile Limitations
- **Audio Quality:** May vary by device
- **Battery Usage:** Continuous audio processing
- **Network:** Requires stable connection

## 🔒 Security

### HTTPS Requirement
- **Development:** HTTP allowed for localhost
- **Production:** HTTPS required for microphone access
- **WebSocket:** Use WSS in production

### Data Privacy
- **No Storage:** Audio data not stored locally
- **Memory Only:** Transcripts cleared on page refresh
- **Secure Transmission:** Encrypted WebSocket connection

## 📊 Performance

### Optimization Tips
- **Audio Buffer:** Optimized chunk size (4096)
- **Debouncing:** Translation requests debounced (1.5s)
- **Memory Management:** Automatic cleanup of old transcripts
- **Lazy Loading:** Components loaded on demand

### Monitoring
```javascript
// Performance monitoring
const startTime = performance.now();
// ... audio processing ...
const endTime = performance.now();
console.log(`Audio processing took ${endTime - startTime} milliseconds`);
```

## 🎓 Learning Resources

- [React Hooks Documentation](https://reactjs.org/docs/hooks-intro.html)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/guide/)
