import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Globe, Loader, CheckCircle, AlertCircle } from 'lucide-react';

const RealtimeTranslator = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [translation, setTranslation] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [status, setStatus] = useState('Disconnected');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  // API Key yönetimi
  const saveApiKey = (key) => {
    localStorage.setItem('openai_api_key', key);
    setApiKey(key);
    setShowApiKeyInput(false);
  };

  const loadApiKey = () => {
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    } else {
      setShowApiKeyInput(true);
    }
  };

  // WebSocket bağlantısı - OpenAI dokümantasyonuna göre optimize edildi
  const connectWebSocket = () => {
    if (!apiKey) {
      console.log('❌ API key required');
      setShowApiKeyInput(true);
      return;
    }

    // Önceki bağlantıyı güvenli şekilde kapat
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close(1000, 'Reconnecting');
      }
    }
    
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('✅ Connected to server');
      setIsConnected(true);
      setStatus('Connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setIsConnected(false);
      setStatus('Connection error');
    };

    ws.onclose = (event) => {
      console.log('🔌 Disconnected from server', event.code, event.reason);
      setIsConnected(false);
      setStatus('Disconnected');
      
      // Otomatik yeniden bağlanma (sadece beklenmeyen kapanmalar için)
      if (event.code !== 1000 && event.code !== 1001) {
        setTimeout(() => {
          if (!isConnected) {
            console.log('🔄 Attempting to reconnect...');
            connectWebSocket();
          }
        }, 3000);
      }
    };

    wsRef.current = ws;
  };

  // Server mesajlarını işle - OpenAI dokümantasyonuna göre genişletildi
  const handleServerMessage = (message) => {
    switch (message.type) {
      case 'status':
        setStatus(message.message);
        break;

      case 'transcript':
        // Yeni transcript geldi
        setTranscript(prev => [...prev, {
          id: Date.now(),
          text: message.data.text,
          timestamp: message.data.timestamp,
          corrected: false,
          corrections: [],
        }]);
        break;

      case 'corrections':
        // Düzeltmeler geldi
        setCurrentTopic(message.data.topic);
        applyCorrections(message.data.corrections);
        break;

      case 'translation':
        // Çeviri geldi
        if (message.data.partial) {
          setTranslation(prev => prev + message.data.text);
        } else {
          // Çeviri tamamlandı
          console.log('✅ Translation complete');
        }
        break;

      case 'error':
        setStatus('Error: ' + message.message);
        console.error('❌ Server error:', message.message);
        break;
        
      case 'session.created':
        console.log('✅ Realtime session created');
        setStatus('Session created');
        break;
        
      case 'session.updated':
        console.log('✅ Realtime session updated');
        break;
        
      case 'speech_started':
        console.log('🎤 Speech started');
        setStatus('Speech detected...');
        break;
        
      case 'speech_stopped':
        console.log('🎤 Speech stopped');
        setStatus('Processing...');
        break;
        
      case 'audio_buffer_committed':
        console.log('✅ Audio buffer committed');
        break;
        
      default:
        console.log('📨 Unknown message type:', message.type);
    }
  };

  // Düzeltmeleri uygula
  const applyCorrections = (corrections) => {
    setTranscript(prev => {
      const updated = [...prev];
      
      corrections.forEach(correction => {
        // Son birkaç transcript'i tara ve düzelt
        for (let i = updated.length - 1; i >= Math.max(0, updated.length - 5); i--) {
          if (updated[i].text.includes(correction.original)) {
            updated[i] = {
              ...updated[i],
              corrections: [...(updated[i].corrections || []), correction],
              needsAnimation: true,
            };
          }
        }
      });
      
      return updated;
    });
  };

  // Mikrofon başlat - OpenAI dokümantasyonuna göre optimize edildi
  const startRecording = async () => {
    try {
      // Mikrofon izni iste (OpenAI standartları)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 24000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      streamRef.current = stream;

      // AudioContext oluştur (24kHz OpenAI standardı)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
        latencyHint: 'interactive', // Düşük latency için
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      // Modern AudioWorkletNode kullan (OpenAI önerisi)
      let processor;
      
      try {
        // AudioWorkletNode kullanmaya çalış
        await audioContext.audioWorklet.addModule('/audio-processor.js');
        processor = new AudioWorkletNode(audioContext, 'audio-processor', {
          processorOptions: {
            sampleRate: 24000,
            bufferSize: 4096,
          }
        });
        
        processor.port.onmessage = (event) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
          
          const audioData = event.data;
          
          // Base64'e çevir ve gönder (OpenAI format)
          const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(audioData)));
          
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64,
          }));
        };
        
        console.log('✅ Using AudioWorkletNode (OpenAI optimized)');
      console.log('🎵 Sample rate:', audioContext.sampleRate);
      } catch (error) {
        console.warn('⚠️ AudioWorkletNode not supported, falling back to ScriptProcessorNode');
        
        // Fallback: ScriptProcessorNode kullan (OpenAI uyumlu)
        processor = audioContext.createScriptProcessor(4096, 1, 1);
        
        processor.onaudioprocess = (e) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          
          // Float32Array'i Int16Array'e çevir (PCM16 - OpenAI standardı)
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Base64'e çevir ve gönder
          const base64 = btoa(String.fromCharCode.apply(null, new Uint8Array(pcm16.buffer)));
          
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            audio: base64,
          }));
        };
      }
      
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Sunucuya başlat mesajı gönder (API key, dil ve sample rate ile)
      wsRef.current.send(JSON.stringify({ 
        type: 'start',
        apiKey: apiKey,
        language: targetLanguage, // Zaten ISO kodu
        sampleRate: audioContext.sampleRate // Frontend'in sample rate'i
      }));

      setIsRecording(true);
      setStatus('Recording...');

    } catch (error) {
      console.error('❌ Microphone error:', error);
      setStatus('Microphone access denied');
    }
  };

  // Kaydı durdur
  const stopRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    // WebSocket durumunu kontrol et
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }

    setIsRecording(false);
    setStatus('Stopped');
  };

  // Çeviri iste - OpenAI dokümantasyonuna göre optimize edildi
  const requestTranslation = (text) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && text.trim()) {
      setTranslation('');
      wsRef.current.send(JSON.stringify({
        type: 'translate',
        text: text.trim(),
        targetLanguage,
        timestamp: Date.now(),
      }));
    }
  };

  // Component mount
  useEffect(() => {
    loadApiKey();
  }, []);

  // API key değiştiğinde bağlan
  useEffect(() => {
    if (apiKey) {
      connectWebSocket();
    }
  }, [apiKey]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopRecording();
    };
  }, []);

  // Auto-translate son cümleyi
  useEffect(() => {
    if (transcript.length > 0) {
      const lastTranscript = transcript[transcript.length - 1];
      // Her yeni transcript için çeviri başlat (debounce ile)
      const timeout = setTimeout(() => {
        const recentText = transcript.slice(-3).map(t => t.text).join(' ');
        requestTranslation(recentText);
      }, 1500);
      
      return () => clearTimeout(timeout);
    }
  }, [transcript]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Real-time AI Translator
          </h1>
          <p className="text-gray-400">Context-aware speech translation with intelligent correction</p>
        </div>

        {/* API Key Input Modal */}
        {showApiKeyInput && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-semibold mb-4 text-white">OpenAI API Key</h3>
              <p className="text-gray-400 mb-4 text-sm">
                Enter your OpenAI API key to use the real-time translation service.
              </p>
              <input
                type="password"
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => saveApiKey(apiKey)}
                  disabled={!apiKey.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition-all"
                >
                  Save & Connect
                </button>
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg font-semibold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Bar */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-sm">{status}</span>
            {apiKey && (
              <button
                onClick={() => setShowApiKeyInput(true)}
                className="text-xs bg-blue-500/20 hover:bg-blue-500/30 px-2 py-1 rounded text-blue-300 transition-all"
              >
                Change API Key
              </button>
            )}
          </div>
          
          {currentTopic && (
            <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-1 rounded-full">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Topic: {currentTopic}</span>
            </div>
          )}

          <select 
            value={targetLanguage}
            onChange={(e) => {
              setTargetLanguage(e.target.value);
              // Backend'e dil değişikliğini bildir (ISO 639-1 kodları)
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'update_language',
                  language: e.target.value, // Zaten ISO kodları
                }));
              }
            }}
            className="bg-slate-700 rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-purple-400"
          >
            <option value="en">English</option>
            <option value="tr">Turkish</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="fr">French</option>
            <option value="ar">Arabic</option>
            <option value="zh">Chinese</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="ru">Russian</option>
            <option value="pt">Portuguese</option>
            <option value="it">Italian</option>
            <option value="nl">Dutch</option>
            <option value="sv">Swedish</option>
            <option value="da">Danish</option>
            <option value="no">Norwegian</option>
            <option value="fi">Finnish</option>
            <option value="pl">Polish</option>
            <option value="cs">Czech</option>
            <option value="hu">Hungarian</option>
            <option value="ro">Romanian</option>
            <option value="bg">Bulgarian</option>
            <option value="hr">Croatian</option>
            <option value="sk">Slovak</option>
            <option value="sl">Slovenian</option>
            <option value="et">Estonian</option>
            <option value="lv">Latvian</option>
            <option value="lt">Lithuanian</option>
            <option value="el">Greek</option>
            <option value="he">Hebrew</option>
            <option value="hi">Hindi</option>
            <option value="th">Thai</option>
            <option value="vi">Vietnamese</option>
            <option value="id">Indonesian</option>
            <option value="ms">Malay</option>
            <option value="tl">Tagalog</option>
            <option value="sw">Swahili</option>
            <option value="af">Afrikaans</option>
            <option value="az">Azerbaijani</option>
            <option value="be">Belarusian</option>
            <option value="bs">Bosnian</option>
            <option value="ca">Catalan</option>
            <option value="cy">Welsh</option>
            <option value="fa">Persian</option>
            <option value="gl">Galician</option>
            <option value="hy">Armenian</option>
            <option value="is">Icelandic</option>
            <option value="iw">Hebrew (iw)</option>
            <option value="kk">Kazakh</option>
            <option value="kn">Kannada</option>
            <option value="mi">Maori</option>
            <option value="mk">Macedonian</option>
            <option value="mr">Marathi</option>
            <option value="ne">Nepali</option>
            <option value="uk">Ukrainian</option>
            <option value="ur">Urdu</option>
          </select>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          
          {/* Original Transcript Panel */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-blue-400" />
              Original Transcript
            </h2>
            
            <div className="h-96 overflow-y-auto space-y-3 pr-2">
              {transcript.length === 0 ? (
                <div className="text-gray-500 text-center mt-20">
                  Start recording to see transcript...
                </div>
              ) : (
                transcript.map((item, idx) => (
                  <TranscriptItem key={item.id} item={item} />
                ))
              )}
            </div>
          </div>

          {/* Translation Panel */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-400" />
              Translation ({targetLanguage})
            </h2>
            
            <div className="h-96 overflow-y-auto pr-2">
              {translation ? (
                <p className="text-lg leading-relaxed text-gray-200">{translation}</p>
              ) : (
                <div className="text-gray-500 text-center mt-20 flex flex-col items-center gap-3">
                  <Loader className="w-8 h-8 animate-spin" />
                  Waiting for translation...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!isConnected}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
            >
              <Mic className="w-6 h-6" />
              Start Recording
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 px-8 py-4 rounded-xl font-semibold text-lg flex items-center gap-3 transition-all transform hover:scale-105 shadow-lg animate-pulse"
            >
              <MicOff className="w-6 h-6" />
              Stop Recording
            </button>
          )}

          <button
            onClick={() => {
              setTranscript([]);
              setTranslation('');
            }}
            className="bg-slate-700 hover:bg-slate-600 px-6 py-4 rounded-xl font-semibold transition-all"
          >
            Clear All
          </button>
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-blue-200">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <strong>AI-Powered Correction:</strong> The system automatically detects and corrects entity recognition errors like "NBC" → "NBA" based on conversation context. Watch for the smooth word transformations!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Transcript Item Component with Correction Animation
const TranscriptItem = ({ item }) => {
  const [displayText, setDisplayText] = useState(item.text);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (item.corrections && item.corrections.length > 0 && item.needsAnimation) {
      // Apply corrections with animation
      let updatedText = item.text;
      
      item.corrections.forEach((correction, idx) => {
        setTimeout(() => {
          setAnimating(true);
          
          setTimeout(() => {
            updatedText = updatedText.replace(correction.original, correction.corrected);
            setDisplayText(updatedText);
            
            setTimeout(() => {
              setAnimating(false);
            }, 300);
          }, 500);
        }, idx * 800);
      });
    }
  }, [item.corrections, item.needsAnimation]);

  const hasCorrections = item.corrections && item.corrections.length > 0;

  return (
    <div className={`p-3 rounded-lg transition-all duration-500 ${
      animating ? 'bg-purple-500/20 scale-105' : hasCorrections ? 'bg-green-500/10' : 'bg-slate-700/50'
    }`}>
      <p className={`text-base leading-relaxed transition-all duration-500 ${
        animating ? 'text-purple-300' : 'text-gray-200'
      }`}>
        {displayText}
      </p>
      
      {hasCorrections && !animating && (
        <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
          <CheckCircle className="w-3 h-3" />
          <span>Corrected: {item.corrections.map(c => `${c.original} → ${c.corrected}`).join(', ')}</span>
        </div>
      )}
      
      <div className="text-xs text-gray-500 mt-1">
        {new Date(item.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default RealtimeTranslator;
