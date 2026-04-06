export interface TTSCallbacks {
  onAmplitude: (amplitude: number) => void; // per frame, mouth openness 0..1
  onComplete: () => void; // all audio finished
  onError: (error: Error) => void;
}

export class CartesiaTTS {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private queue: ArrayBuffer[] = [];
  private playing = false;
  private animFrameId = 0;
  private callbacks: TTSCallbacks | null = null;
  private amplitudeData: Uint8Array<ArrayBuffer> | null = null;
  private smoothedAmplitude = 0;
  private abortController: AbortController | null = null;

  async init(callbacks: TTSCallbacks): Promise<void> {
    this.callbacks = callbacks;
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.6;
    this.amplitudeData = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  async speak(sentence: string): Promise<void> {
    if (!this.audioContext) return;
    this.abortController = new AbortController();
    try {
      const response = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sentence }),
        signal: this.abortController.signal,
      });
      if (!response.ok) {
        this.callbacks?.onError(new Error('TTS request failed'));
        return;
      }
      const audioData = await response.arrayBuffer();
      this.queue.push(audioData);
      if (!this.playing) this.playNext();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      this.callbacks?.onError(
        err instanceof Error ? err : new Error('TTS error'),
      );
    }
  }

  private async playNext(): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;
    const data = this.queue.shift();
    if (!data) {
      this.playing = false;
      this.stopAmplitudeLoop();
      this.callbacks?.onAmplitude(0);
      this.callbacks?.onComplete();
      return;
    }
    this.playing = true;
    this.startAmplitudeLoop();
    try {
      const buffer = await this.audioContext.decodeAudioData(data);
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.onended = () => this.playNext();
      source.start();
    } catch {
      this.playNext();
    }
  }

  private startAmplitudeLoop(): void {
    if (this.animFrameId) return; // already running
    const tick = () => {
      if (!this.analyser || !this.amplitudeData || !this.callbacks) return;
      this.analyser.getByteFrequencyData(this.amplitudeData);
      let sum = 0;
      for (let i = 0; i < this.amplitudeData.length; i++)
        sum += this.amplitudeData[i];
      const raw = sum / this.amplitudeData.length / 255;
      this.smoothedAmplitude += (raw - this.smoothedAmplitude) * 0.3;
      const mouthOpen =
        this.smoothedAmplitude > 0.02
          ? Math.min(1, this.smoothedAmplitude * 3)
          : 0;
      this.callbacks.onAmplitude(mouthOpen);
      this.animFrameId = requestAnimationFrame(tick);
    };
    this.animFrameId = requestAnimationFrame(tick);
  }

  private stopAmplitudeLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.stopAmplitudeLoop();
    this.queue = [];
    this.playing = false;
    this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    this.gainNode = null;
  }
}
