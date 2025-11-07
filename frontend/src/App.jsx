import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Globe, Loader, CheckCircle, AlertCircle, Zap } from 'lucide-react';

const RealtimeTranslator = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // 🆕 ADIM 1.0b: Unified chunks state (transcript + translation birlikte)
  const [chunks, setChunks] = useState([]);
  // Chunk yapısı: { id, transcript: { original, corrected, timestamp, status }, translation: { text, status, timestamp } }
  
  // 🆕 ADIM 1.4: Cleanup konfigürasyonu
  const MAX_CHUNKS_DISPLAY = 100; // UI'da max 100 chunk göster
  
  // ⚠️ ESKİ state'ler (geçici olarak tutuyoruz, sonra sileceğiz)
  const [transcript, setTranscript] = useState([]); // Artık kullanılmayacak
  const [translation, setTranslation] = useState(''); // Artık kullanılmayacak
  
  const [currentTopic, setCurrentTopic] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('English');
  const [status, setStatus] = useState('Disconnected');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [latencyStats, setLatencyStats] = useState({ stt: 0, correction: 0, translation: 0 });
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const lastTranscriptTimeRef = useRef(Date.now());

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
    const now = Date.now();
    
    switch (message.type) {
      case 'status':
        setStatus(message.message);
        break;

      case 'transcript':
        // Gecikmeyi ölç
        const sttLatency = now - lastTranscriptTimeRef.current;
        setLatencyStats(prev => ({ ...prev, stt: sttLatency }));
        lastTranscriptTimeRef.current = now;
        
        // 🆕 ADIM 1.0b: Yeni chunk oluştur (unified state)
        setChunks(prev => [...prev, {
          id: message.data.id, // Backend'den gelen ID
          transcript: {
            original: message.data.text,
            corrected: null,
            timestamp: message.data.timestamp,
            status: 'pending' // pending, correcting, corrected
          },
          translation: {
            text: '',
            status: 'none', // none, translating, done, retranslating
            timestamp: null
          }
        }]);
        
        // 🆕 ADIM 1.4: Otomatik cleanup (MAX_CHUNKS_DISPLAY aşarsa)
        setChunks(prev => {
          if (prev.length > MAX_CHUNKS_DISPLAY) {
            // En eski chunk'ları sil (FIFO)
            const chunksToRemove = prev.length - MAX_CHUNKS_DISPLAY;
            console.log(`🗑️ Frontend cleanup: Removing ${chunksToRemove} old chunks`);
            return prev.slice(chunksToRemove);
          }
          return prev;
        });
        
        // ⚠️ ESKİ kod (yedek - sonra sileceğiz)
        setTranscript(prev => [...prev, {
          id: message.data.id || Date.now(),
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

      case 'translation_start':
        // 🆕 ADIM 1.0b: Bu chunk için çeviri başladı
        if (message.data.for_chunk_id) {
          setChunks(prev => prev.map(chunk => {
            if (chunk.id === message.data.for_chunk_id) {
              return {
                ...chunk,
                translation: {
                  text: '',
                  status: 'translating',
                  timestamp: now
                }
              };
            }
            return chunk;
          }));
        }
        
        // ⚠️ ESKİ kod (yedek)
        setTranslation('');
        break;

      case 'translation':
        // 🆕 ADIM 1.0b: Streaming translation (chunk bazlı)
        if (message.data.for_chunk_id && message.data.partial) {
          setChunks(prev => prev.map(chunk => {
            if (chunk.id === message.data.for_chunk_id) {
              return {
                ...chunk,
                translation: {
                  text: chunk.translation.text + message.data.text,
                  status: 'translating',
                  timestamp: now
                }
              };
            }
            return chunk;
          }));
        } else if (message.data.for_chunk_id && !message.data.partial) {
          // Translation tamamlandı
          setChunks(prev => prev.map(chunk => {
            if (chunk.id === message.data.for_chunk_id) {
              return {
                ...chunk,
                translation: {
                  ...chunk.translation,
                  status: 'done'
                }
              };
            }
            return chunk;
          }));
        }
        
        // ⚠️ ESKİ kod (yedek - henüz for_chunk_id backend'den gelmiyor)
        if (message.data.partial) {
          setTranslation(prev => prev + message.data.text);
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

  // Düzeltmeleri uygula (🆕 ADIM 1.0d: chunks state'e uygulandı)
  const applyCorrections = (corrections) => {
    // Eski transcript state için (geriye uyumluluk)
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
    
    // 🆕 YENİ: chunks state'e de uygula
    setChunks(prev => {
      return prev.map(chunk => {
        // Bu chunk'ta düzeltme var mı?
        const affectedCorrections = corrections.filter(c => 
          chunk.transcript.original?.includes(c.original)
        );
        
        if (affectedCorrections.length > 0) {
          // Düzeltilmiş metni oluştur
          let correctedText = chunk.transcript.original;
          affectedCorrections.forEach(c => {
            correctedText = correctedText.replace(
              new RegExp(c.original, 'gi'),
              c.corrected
            );
          });
          
          return {
            ...chunk,
            transcript: {
              ...chunk.transcript,
              corrected: correctedText,
              status: 'corrected',
              corrections: affectedCorrections
            }
          };
        }
        
        return chunk;
      });
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
            bufferSize: 2048, // YENİ: 4096'dan 2048'e düşür
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
        processor = audioContext.createScriptProcessor(2048, 1, 1); // YENİ: 4096'dan 2048'e
        
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
        language: 'en', // veya dinamik
        targetLanguage: targetLanguage,
        sampleRate: audioContext.sampleRate // Frontend'in sample rate'i
      }));

      setIsRecording(true);
      setStatus('Recording...');
      lastTranscriptTimeRef.current = Date.now();

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

  // Hedef dili değiştir
  const changeTargetLanguage = (newLang) => {
    setTargetLanguage(newLang);
    
    // Backend'e bildir
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_target_language',
        targetLanguage: newLang
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

  // YENİ: Debounce kaldırıldı - backend otomatik çeviri yapıyor

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Real-time AI Translator
          </h1>
          <p className="text-gray-400">Optimized for low latency • 2-3s response time</p>
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
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
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
              
              {/* YENİ: Latency göstergesi */}
              {isRecording && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Zap className="w-3 h-3" />
                  <span>STT: {latencyStats.stt}ms</span>
                </div>
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
              onChange={(e) => changeTargetLanguage(e.target.value)}
              className="bg-slate-700 rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-purple-400"
            >
              <option>English</option>
              <option>Turkish</option>
              <option>Spanish</option>
              <option>German</option>
              <option>French</option>
            </select>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          
          {/* 🆕 ADIM 1.0b: Unified Chunks Panel (Transcript + Translation birlikte) */}
          <div className="bg-slate-800/50 backdrop-blur rounded-xl p-6 col-span-2">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Real-time Transcript & Translation (Chunk-based)
              {/* 🆕 ADIM 1.4: Chunk sayısı göstergesi */}
              <span className="text-xs text-gray-400 ml-auto">
                {chunks.length}/{MAX_CHUNKS_DISPLAY} chunks
              </span>
            </h2>
            
            <div className="h-96 overflow-y-auto space-y-4 pr-2">
              {chunks.length === 0 ? (
                <div className="text-gray-500 text-center mt-20">
                  Start recording to see chunks...
                </div>
              ) : (
                chunks.map((chunk) => (
                  <div 
                    key={chunk.id} 
                    className={`
                      rounded-lg p-4 border transition-all duration-300
                      ${chunk.transcript.status === 'corrected' 
                        ? 'bg-green-900/20 border-green-500/50' 
                        : 'bg-slate-700/50 border-slate-600'
                      }
                    `}
                  >
                    {/* Transcript */}
                    <div className="mb-2">
                      <span className="text-xs text-gray-400 mr-2">🎤</span>
                      <span className="text-gray-200">{chunk.transcript.original}</span>
                      {chunk.transcript.corrected && (
                        <div className="ml-6 mt-1 animate-fade-in">
                          <span className="text-green-400">
                            → {chunk.transcript.corrected}
                          </span>
                        </div>
                      )}
                      {/* 🆕 ADIM 1.0d: Düzeltme detayları */}
                      {chunk.transcript.corrections && chunk.transcript.corrections.length > 0 && (
                        <div className="text-xs text-green-300 mt-1 ml-6 animate-fade-in">
                          ✓ Corrected: {chunk.transcript.corrections.map((correction, idx) => 
                            <span key={idx}>
                              "{correction.original}" → "{correction.corrected}"
                              {/* 🆕 ADIM 2.3: Confidence badge */}
                              {correction.confidence && (
                                <span className="ml-2 px-2 py-0.5 bg-green-500/20 rounded text-green-400">
                                  {Math.round(correction.confidence * 100)}%
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Translation */}
                    <div className="text-sm">
                      <span className="text-xs text-blue-400 mr-2">🌍</span>
                      {chunk.translation.status === 'none' ? (
                        <span className="text-gray-500 italic">Waiting...</span>
                      ) : chunk.translation.status === 'translating' ? (
                        <span className="text-blue-300 animate-pulse">{chunk.translation.text}</span>
                      ) : chunk.translation.status === 'retranslating' ? (
                        <span className="text-yellow-300 animate-pulse">
                          🔄 Retranslating... {chunk.translation.text}
                        </span>
                      ) : (
                        <span className="text-blue-200">{chunk.translation.text}</span>
                      )}
                    </div>
                    
                    {/* Debug: Chunk ID + Status */}
                    <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                      <span>ID: {chunk.id.slice(-12)}</span>
                      {/* 🆕 ADIM 2.3: Status indicator */}
                      {chunk.transcript.status === 'corrected' && (
                        <span className="px-2 py-0.5 bg-green-500/20 rounded text-green-400">
                          ✓ Corrected
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          {/* ⚠️ ESKİ paneller (yedek - şimdilik gizli, sonra sileceğiz) */}
          {false && (
            <>
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
                transcript.map((item) => (
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
            </>
          )}
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
              setChunks([]); // 🆕 YENİ: chunks'ı temizle
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
              <strong>Optimized Performance:</strong> Corrections trigger every 2s or after 3 transcripts. Translation streams immediately without debounce. Cache enabled for faster processing.
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
          }, 400); // 500'den 400'e düşür
        }, idx * 600); // 800'den 600'e düşür
      });
    }
  }, [item.corrections, item.needsAnimation]);

  const hasCorrections = item.corrections && item.corrections.length > 0;

  return (
    <div className={`p-3 rounded-lg transition-all duration-300 ${
      animating ? 'bg-purple-500/20 scale-105' : hasCorrections ? 'bg-green-500/10' : 'bg-slate-700/50'
    }`}>
      <p className={`text-base leading-relaxed transition-all duration-300 ${
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