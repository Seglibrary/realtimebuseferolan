// server.js - Real-time Translation Backend
// Gerekli paketler: npm install express ws openai dotenv cors

import express from 'express';
import { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Session Management
const sessions = new Map();

class TranscriptionSession {
  constructor(ws) {
    this.ws = ws;
    this.realtimeWs = null;
    this.contextBuffer = []; // Son 60 saniye transkript
    this.pendingCorrections = [];
    this.currentContext = '';
    this.sessionStartTime = Date.now();
    this.lastAnalysisTime = Date.now();
  }

  // Rolling context window (60 saniye)
  addToContext(text, timestamp) {
    this.contextBuffer.push({ text, timestamp });
    
    // 60 saniyeden eski kayıtları temizle
    const cutoffTime = Date.now() - 60000;
    this.contextBuffer = this.contextBuffer.filter(
      item => item.timestamp > cutoffTime
    );
    
    this.currentContext = this.contextBuffer
      .map(item => item.text)
      .join(' ');
  }

  // OpenAI Realtime API'ye bağlan
  async connectToRealtime() {
    try {
      console.log('🔌 Connecting to OpenAI Realtime API...');
      
      // OpenAI Realtime API WebSocket endpoint
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: 'alloy',
        }),
      });

      const session = await response.json();
      
      // WebSocket bağlantısı kur
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'OpenAI-Beta': 'realtime=v1',
          },
        }
      );

      this.realtimeWs = ws;

      ws.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');
        this.ws.send(JSON.stringify({
          type: 'status',
          message: 'Connected to transcription service',
        }));
      });

      ws.on('message', async (data) => {
        const event = JSON.parse(data.toString());
        await this.handleRealtimeEvent(event);
      });

      ws.on('error', (error) => {
        console.error('❌ Realtime API error:', error);
        this.ws.send(JSON.stringify({
          type: 'error',
          message: 'Transcription service error',
        }));
      });

      ws.on('close', () => {
        console.log('🔌 Disconnected from OpenAI Realtime API');
      });

    } catch (error) {
      console.error('❌ Failed to connect to Realtime API:', error);
    }
  }

  // Realtime API eventlerini işle
  async handleRealtimeEvent(event) {
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        const transcript = event.transcript;
        const timestamp = Date.now();
        
        console.log('📝 Transcript:', transcript);
        
        // Context buffer'a ekle
        this.addToContext(transcript, timestamp);
        
        // Client'a gönder (ham transcript)
        this.ws.send(JSON.stringify({
          type: 'transcript',
          data: {
            text: transcript,
            timestamp,
            corrected: false,
          },
        }));
        
        // Her 5 saniyede bir context analizi yap
        if (Date.now() - this.lastAnalysisTime > 5000) {
          this.lastAnalysisTime = Date.now();
          await this.analyzeAndCorrect();
        }
        break;

      case 'conversation.item.input_audio_transcription.failed':
        console.error('❌ Transcription failed:', event.error);
        break;
    }
  }

  // Context-aware correction engine
  async analyzeAndCorrect() {
    if (this.currentContext.length < 50) return; // Minimum context gerekli

    try {
      console.log('🔍 Analyzing context for corrections...');
      
      const prompt = `Analyze this real-time speech transcript and find entity recognition errors.

Transcript: "${this.currentContext}"

Common error patterns:
- Homophones: "NBC" → "NBA" (basketball), "MVW" → "MVP" (awards)
- Name corrections: "Lebron Harden" → "LeBron James"
- Organization names based on context
- Scientific terms: "RNA" vs "NBA" based on topic

Detect the current conversation topic (sports, science, tech, etc.) and correct accordingly.

Return ONLY valid JSON in this exact format:
{
  "topic": "detected topic",
  "corrections": [
    {
      "original": "wrong text",
      "corrected": "right text",
      "position": "approximate word position",
      "confidence": 0.95,
      "reason": "brief explanation"
    }
  ]
}

If no corrections needed, return: {"topic": "detected topic", "corrections": []}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at detecting and correcting named entity recognition errors in speech transcripts. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      if (result.corrections && result.corrections.length > 0) {
        console.log('✅ Found corrections:', result.corrections);
        
        // Client'a düzeltmeleri gönder
        this.ws.send(JSON.stringify({
          type: 'corrections',
          data: {
            topic: result.topic,
            corrections: result.corrections,
          },
        }));
      }

    } catch (error) {
      console.error('❌ Correction analysis failed:', error);
    }
  }

  // Audio data gönder
  sendAudio(audioData) {
    if (this.realtimeWs && this.realtimeWs.readyState === 1) {
      this.realtimeWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audioData,
      }));
    }
  }

  // Çeviri yap
  async translate(text, targetLanguage) {
    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate to ${targetLanguage}.
Rules:
- Preserve named entities (names, brands, organizations)
- Maintain the tone and style
- Use the context provided
Context: ${this.currentContext.slice(-500)}`, // Son 500 karakter
          },
          {
            role: 'user',
            content: text,
          },
        ],
        stream: true,
      });

      // Stream translation to client
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          this.ws.send(JSON.stringify({
            type: 'translation',
            data: {
              text: content,
              language: targetLanguage,
              partial: true,
            },
          }));
        }
      }

      // Translation complete
      this.ws.send(JSON.stringify({
        type: 'translation',
        data: {
          language: targetLanguage,
          partial: false,
        },
      }));

    } catch (error) {
      console.error('❌ Translation failed:', error);
    }
  }

  disconnect() {
    if (this.realtimeWs) {
      this.realtimeWs.close();
    }
  }
}

// HTTP Server
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('👤 New client connected');
  
  const sessionId = Math.random().toString(36).substring(7);
  const session = new TranscriptionSession(ws);
  sessions.set(sessionId, session);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case 'start':
          console.log('▶️  Starting transcription session');
          await session.connectToRealtime();
          break;

        case 'audio':
          // Audio data from client (base64 PCM)
          session.sendAudio(data.audio);
          break;

        case 'translate':
          // Translation request
          await session.translate(data.text, data.targetLanguage);
          break;

        case 'stop':
          console.log('⏹️  Stopping transcription session');
          session.disconnect();
          break;
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
    }
  });

  ws.on('close', () => {
    console.log('👋 Client disconnected');
    session.disconnect();
    sessions.delete(sessionId);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    activeSessions: sessions.size,
    uptime: process.uptime(),
  });
});

console.log('🎙️  Real-time Translation Server Ready!');
console.log('📡 WebSocket endpoint: ws://localhost:' + PORT);