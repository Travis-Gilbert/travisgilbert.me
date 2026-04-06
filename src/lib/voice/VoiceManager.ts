import { DeepgramSTT } from './DeepgramSTT';
import { CartesiaTTS } from './CartesiaTTS';

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'error';

export interface VoiceManagerCallbacks {
  onStateChange: (state: VoiceState) => void;
  onInterimTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onAmplitude: (amplitude: number) => void;
  onError: (error: Error) => void;
}

export class VoiceManager {
  private stt: DeepgramSTT;
  private tts: CartesiaTTS;
  private callbacks: VoiceManagerCallbacks;
  private state: VoiceState = 'idle';
  private ttsInitialized = false;

  constructor(callbacks: VoiceManagerCallbacks) {
    this.callbacks = callbacks;
    this.stt = new DeepgramSTT();
    this.tts = new CartesiaTTS();
  }

  async startListening(): Promise<void> {
    try {
      this.setState('listening');
      await this.stt.start({
        onInterim: (text: string) => {
          this.callbacks.onInterimTranscript(text);
        },
        onFinal: (text: string) => {
          this.callbacks.onFinalTranscript(text);
        },
        onError: (error: Error) => {
          this.setState('error');
          this.callbacks.onError(error);
        },
      });
    } catch (err) {
      this.setState('error');
      this.callbacks.onError(
        err instanceof Error ? err : new Error('Failed to start listening'),
      );
    }
  }

  stopListening(): void {
    this.stt.stop();
    this.setState('idle');
  }

  async speakSentence(text: string): Promise<void> {
    if (!this.ttsInitialized) {
      await this.tts.init({
        onAmplitude: (amplitude: number) => {
          this.callbacks.onAmplitude(amplitude);
        },
        onComplete: () => {
          this.setState('idle');
        },
        onError: (error: Error) => {
          this.setState('error');
          this.callbacks.onError(error);
        },
      });
      this.ttsInitialized = true;
    }

    this.setState('speaking');
    await this.tts.speak(text);
  }

  stopSpeaking(): void {
    this.tts.stop();
    this.ttsInitialized = false;
    this.setState('idle');
  }

  destroy(): void {
    this.stt.stop();
    this.tts.stop();
    this.ttsInitialized = false;
    this.setState('idle');
  }

  getState(): VoiceState {
    return this.state;
  }

  private setState(next: VoiceState): void {
    if (this.state === next) return;
    this.state = next;
    this.callbacks.onStateChange(next);
  }
}
