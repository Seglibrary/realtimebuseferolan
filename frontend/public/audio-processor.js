// AudioWorkletNode için ses işleme worker'ı - OpenAI dokümantasyonuna göre optimize edildi
class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = options.processorOptions?.bufferSize || 4096;
    this.sampleRate = options.processorOptions?.sampleRate || 24000;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.isProcessing = false;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const inputChannel = input[0];
    
    if (inputChannel && !this.isProcessing) {
      this.isProcessing = true;
      
      // Buffer'ı doldur
      for (let i = 0; i < inputChannel.length; i++) {
        this.buffer[this.bufferIndex] = inputChannel[i];
        this.bufferIndex++;
        
        // Buffer dolduğunda işle ve gönder
        if (this.bufferIndex >= this.bufferSize) {
          // Float32Array'i Int16Array'e çevir (PCM16 - OpenAI standardı)
          const pcm16 = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            pcm16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          // Uint8Array'e çevir ve gönder
          const uint8Array = new Uint8Array(pcm16.buffer);
          this.port.postMessage(uint8Array);
          
          // Buffer'ı sıfırla
          this.bufferIndex = 0;
        }
      }
      
      this.isProcessing = false;
    }
    
    return true; // Sürekli çalışmaya devam et
  }
}

registerProcessor('audio-processor', AudioProcessor);
