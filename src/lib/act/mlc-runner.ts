/**
 * MLC WebLLM runner for the gemma-4b-gl-fusion-v1 client-side model.
 *
 * Wraps `@mlc-ai/web-llm` with a small surface tailored to /act:
 *   - getCapability() — does this browser support WebGPU?
 *   - initialize() — kick off the (large) model download + compile
 *   - classifyContent() — JSON-mode classification call
 *   - extractFeatures() — JSON-mode extraction call
 *   - getState() / getLoadProgress() — UI state for the panel-foot hint
 *
 * Lazy-loads `@mlc-ai/web-llm` on first call so the dependency only
 * pulls into the bundle when the page actually wants to run inference.
 * If the user never clicks "Run analysis" or WebGPU is unavailable, the
 * dependency stays out of the cold-start path.
 *
 * The runner is a singleton — only one engine instance is held in
 * memory at a time. The page can ask for it from any component.
 */

import { buildClassifyPrompt, buildExtractionPrompt, unwrapJsonOutput } from './gemma-prompts';

export type RunnerState =
  | 'uninitialized'
  | 'unavailable'
  | 'loading'
  | 'ready'
  | 'error';

export interface LoadProgress {
  percent: number;
  mbLoaded: number;
  mbTotal: number;
  stage: string;
}

export interface ModelDescriptor {
  model_id: string;
  model_url: string;
  model_lib_url: string;
  resolve_base_url: string;
  base_model?: string;
  lora_source?: string;
  training?: string;
  quantization?: string;
}

interface RawProgress {
  progress?: number;
  text?: string;
  timeElapsed?: number;
}

let singleton: MLCRunner | null = null;

export class MLCRunner {
  private state: RunnerState = 'uninitialized';
  private loadProgress: LoadProgress = { percent: 0, mbLoaded: 0, mbTotal: 0, stage: 'idle' };
  // Engine type imported lazily; using `unknown` avoids importing from
  // @mlc-ai/web-llm in module scope (which would force the dep into
  // every page bundle).
  private engine: unknown = null;
  private descriptor: ModelDescriptor | null = null;
  private loadPromise: Promise<void> | null = null;

  static get(): MLCRunner {
    if (!singleton) singleton = new MLCRunner();
    return singleton;
  }

  static reset(): void {
    singleton = null;
  }

  /** Returns true if the host browser supports WebGPU. */
  static async getCapability(): Promise<{ webgpu: boolean; reason?: string }> {
    if (typeof window === 'undefined') {
      return { webgpu: false, reason: 'Server context.' };
    }
    const nav = window.navigator as Navigator & { gpu?: unknown };
    if (!nav.gpu) {
      return { webgpu: false, reason: 'WebGPU is not enabled in this browser.' };
    }
    try {
      const gpu = nav.gpu as { requestAdapter: () => Promise<unknown | null> };
      const adapter = await gpu.requestAdapter();
      if (!adapter) {
        return {
          webgpu: false,
          reason: 'No GPU adapter available (try a Chrome/Edge build with WebGPU enabled).',
        };
      }
      return { webgpu: true };
    } catch (err) {
      return {
        webgpu: false,
        reason: err instanceof Error ? err.message : 'Failed to request a WebGPU adapter.',
      };
    }
  }

  getState(): RunnerState {
    return this.state;
  }

  getLoadProgress(): LoadProgress {
    return this.loadProgress;
  }

  getDescriptor(): ModelDescriptor | null {
    return this.descriptor;
  }

  /**
   * Begin loading the model. Idempotent; the same in-flight promise is
   * returned to all callers, so the page can call this from multiple
   * places without triggering parallel downloads.
   */
  async initialize(
    descriptorUrl = '/act/model.json',
    onProgress?: (p: LoadProgress) => void,
  ): Promise<void> {
    if (this.state === 'ready') return;
    if (this.loadPromise) return this.loadPromise;

    const cap = await MLCRunner.getCapability();
    if (!cap.webgpu) {
      this.state = 'unavailable';
      this.loadProgress = {
        percent: 0,
        mbLoaded: 0,
        mbTotal: 0,
        stage: cap.reason ?? 'WebGPU unavailable',
      };
      onProgress?.(this.loadProgress);
      return;
    }

    this.state = 'loading';
    this.loadPromise = this._doLoad(descriptorUrl, onProgress).catch((err: unknown) => {
      this.state = 'error';
      this.loadProgress = {
        percent: 0,
        mbLoaded: 0,
        mbTotal: 0,
        stage: err instanceof Error ? err.message : 'Failed to load model.',
      };
      onProgress?.(this.loadProgress);
      this.loadPromise = null;
      throw err;
    });
    return this.loadPromise;
  }

  private async _doLoad(
    descriptorUrl: string,
    onProgress?: (p: LoadProgress) => void,
  ): Promise<void> {
    const descRes = await fetch(descriptorUrl);
    if (!descRes.ok) {
      throw new Error(`Could not fetch ${descriptorUrl} (HTTP ${descRes.status}).`);
    }
    const descriptor = (await descRes.json()) as ModelDescriptor;
    this.descriptor = descriptor;

    const reportInit: LoadProgress = {
      percent: 0,
      mbLoaded: 0,
      mbTotal: 0,
      stage: `Fetching ${descriptor.model_id}…`,
    };
    this.loadProgress = reportInit;
    onProgress?.(reportInit);

    const webllm = await import('@mlc-ai/web-llm');

    const appConfig = {
      model_list: [
        {
          model: descriptor.model_url,
          model_id: descriptor.model_id,
          model_lib: descriptor.model_lib_url,
          // Resolve_base_url is honored by web-llm via the `model` URL
          // already; keep declarations minimal so MLC can pick its own
          // CDN strategy.
        },
      ],
    };

    const initProgressCallback = (report: RawProgress) => {
      const percent = Math.round((report.progress ?? 0) * 100);
      const stageText = report.text ?? '';
      // Extract MB counts when web-llm reports them in the text; the
      // shape varies by web-llm version, so we just regex.
      let mbLoaded = 0;
      let mbTotal = 0;
      const mbMatch = stageText.match(/([\d.]+)\s*\/\s*([\d.]+)\s*MB/);
      if (mbMatch) {
        mbLoaded = Number.parseFloat(mbMatch[1]);
        mbTotal = Number.parseFloat(mbMatch[2]);
      }
      const update: LoadProgress = {
        percent,
        mbLoaded,
        mbTotal,
        stage: stageText.slice(0, 120),
      };
      this.loadProgress = update;
      onProgress?.(update);
    };

    const engine = await webllm.CreateMLCEngine(descriptor.model_id, {
      appConfig,
      initProgressCallback,
    });
    this.engine = engine;
    this.state = 'ready';
    this.loadProgress = {
      percent: 100,
      mbLoaded: this.loadProgress.mbTotal,
      mbTotal: this.loadProgress.mbTotal,
      stage: 'Model loaded.',
    };
    onProgress?.(this.loadProgress);
  }

  /**
   * Run a JSON-mode chat completion on the loaded model. Returns the
   * raw response string for the caller to parse.
   */
  private async _chat(prompt: string, maxTokens = 1024, temperature = 0.2): Promise<string> {
    if (this.state !== 'ready' || !this.engine) {
      throw new Error(`Model not ready (state=${this.state}).`);
    }
    type ChatEngine = {
      chat: {
        completions: {
          create: (args: {
            messages: { role: 'user' | 'system'; content: string }[];
            temperature?: number;
            max_tokens?: number;
            response_format?: { type: 'json_object' };
          }) => Promise<{ choices: { message: { content?: string } }[] }>;
        };
      };
    };
    const engine = this.engine as ChatEngine;
    const response = await engine.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async classifyContent(text: string): Promise<unknown> {
    const raw = await this._chat(buildClassifyPrompt(text), 256, 0.0);
    return JSON.parse(unwrapJsonOutput(raw));
  }

  async extractFeatures(text: string): Promise<unknown> {
    const raw = await this._chat(buildExtractionPrompt(text), 2048, 0.2);
    return JSON.parse(unwrapJsonOutput(raw));
  }
}
