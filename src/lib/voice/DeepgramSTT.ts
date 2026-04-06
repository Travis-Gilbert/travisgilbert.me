export interface STTCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: Error) => void;
}

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private audioContext: AudioContext | null = null;
  private pcmBuffer: Int16Array | null = null;

  async start(callbacks: STTCallbacks): Promise<void> {
    const tokenRes = await fetch('/api/voice/token', { method: 'POST' });
    if (!tokenRes.ok) {
      callbacks.onError(new Error('Failed to get Deepgram token'));
      return;
    }
    const { key } = await tokenRes.json();

    const wsUrl =
      'wss://api.deepgram.com/v1/listen?model=nova-3&language=en&smart_format=true&interim_results=true';
    this.ws = new WebSocket(wsUrl, ['token', key]);

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (!transcript) return;
        if (data.is_final) {
          callbacks.onFinal(transcript);
        } else {
          callbacks.onInterim(transcript);
        }
      } catch {
        /* ignore parse errors */
      }
    };

    // Wait for connection, then restore the error handler for runtime errors
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));
      this.ws.onopen = () => {
        // Restore the runtime error handler after connection succeeds
        if (this.ws) {
          this.ws.onerror = () =>
            callbacks.onError(new Error('Deepgram WebSocket error'));
        }
        resolve();
      };
      this.ws.onerror = () => reject(new Error('WebSocket connection failed'));
    });

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Pre-allocate PCM buffer (reused across callbacks to reduce GC pressure)
    this.pcmBuffer = new Int16Array(4096);

    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      if (this.ws?.readyState !== WebSocket.OPEN || !this.pcmBuffer) return;
      const float32 = e.inputBuffer.getChannelData(0);
      const len = float32.length;
      // Reuse buffer if same size, otherwise reallocate
      if (this.pcmBuffer.length !== len) {
        this.pcmBuffer = new Int16Array(len);
      }
      for (let i = 0; i < len; i++) {
        this.pcmBuffer[i] = Math.max(
          -32768,
          Math.min(32767, Math.round(float32[i] * 32768)),
        );
      }
      this.ws.send(this.pcmBuffer.buffer);
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  stop(): void {
    this.processor?.disconnect();
    this.audioContext?.close();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.ws = null;
    this.mediaStream = null;
    this.processor = null;
    this.audioContext = null;
    this.pcmBuffer = null;
  }
}
