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
  
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);

  // WebSocket bağlantısı
  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = () => {
      console.log('✅ Connected to server');
      setIsConnected(true);
      setStatus('Connected');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    };

    ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      setStatus('Connection error');
    };

    ws.onclose = () => {
      console.log('🔌 Disconnected from server');
      setIsConnected(false);
      setStatus('Disconnected');
    };

    wsRef.current = ws;
  };

  // Server mesajlarını işle
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
        break;
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

  // Mikrofon başlat
  const startRecording = async () => {
    try {
      // Mikrofon izni iste
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 24000,
        } 
      });
      
      streamRef.current = stream;

      // AudioContext oluştur
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 24000,
      });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      
      // ScriptProcessor ile audio data yakala
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

        const inputData = e.inputBuffer.getChannelData(0);
        
        // Float32Array'i Int16Array'e çevir (PCM16)
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

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Sunucuya başlat mesajı gönder
      wsRef.current.send(JSON.stringify({ type: 'start' }));

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
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }));
    }

    setIsRecording(false);
    setStatus('Stopped');
  };

  // Çeviri iste
  const requestTranslation = (text) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setTranslation('');
      wsRef.current.send(JSON.stringify({
        type: 'translate',
        text,
        targetLanguage,
      }));
    }
  };

  // Component mount
  useEffect(() => {
    connectWebSocket();

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

        {/* Status Bar */}
        <div className="bg-slate-800/50 backdrop-blur rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-sm">{status}</span>
          </div>
          
          {currentTopic && (
            <div className="flex items-center gap-2 bg-purple-500/20 px-3 py-1 rounded-full">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Topic: {currentTopic}</span>
            </div>
          )}

          <select 
            value={targetLanguage}
            onChange={(e) => setTargetLanguage(e.target.value)}
            className="bg-slate-700 rounded-lg px-3 py-2 text-sm border border-slate-600 focus:outline-none focus:border-purple-400"
          >
            <option>English</option>
            <option>Turkish</option>
            <option>Spanish</option>
            <option>German</option>
            <option>French</option>
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