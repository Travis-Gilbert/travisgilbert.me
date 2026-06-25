'use client';

/**
 * The omnibar input, ported from the 21st.dev reuno-ui/ai-input component and
 * re-tokenized to the CommonPlace --cp-* language: an auto-resizing textarea
 * with attach, web search, graph-guided expansion, and a send button. It reads
 * as a chat bar (Travis's ask) -- larger than a command pill. The omnibar wires
 * it to Theorem's agent, RustyWeb search, and fractal expansion.
 *
 * Radius note: keeps the rounded chat-bar shape (a deliberate exception to the
 * otherwise-sharp design language, per request).
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { GitBranch, Globe, Paperclip, ArrowUp, Sparkles } from 'lucide-react';

const INPUT_HEIGHT = {
  default: { min: 52, max: 168 },
  tall: { min: 68, max: 190 },
} as const;

export type AiInputMode = 'ask' | 'web' | 'research' | 'fractal';
export type AiInputSize = keyof typeof INPUT_HEIGHT;

function useAutoResize(value: string, minHeight: number, maxHeight: number) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const adjust = React.useCallback((reset?: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.height = `${minHeight}px`;
    if (reset) return;
    el.style.height = `${Math.max(minHeight, Math.min(el.scrollHeight, maxHeight))}px`;
  }, [maxHeight, minHeight]);
  React.useEffect(() => {
    adjust();
  }, [value, adjust]);
  return { ref, adjust };
}

export interface AiInputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  mode: AiInputMode;
  onModeChange: (mode: AiInputMode) => void;
  onAttach?: (file: File) => void;
  placeholder?: string;
  webPlaceholder?: string;
  researchPlaceholder?: string;
  fractalPlaceholder?: string;
  busy?: boolean;
  autoFocus?: boolean;
  size?: AiInputSize;
}

export const AiInputBar = React.forwardRef<HTMLTextAreaElement, AiInputBarProps>(
  function AiInputBar(
    {
      value,
      onChange,
      onSubmit,
      mode,
      onModeChange,
      onAttach,
      placeholder = 'Ask the Theorem agent',
      webPlaceholder = 'Search the web',
      researchPlaceholder = 'Search, then ask Theorem',
      fractalPlaceholder = 'Search the web from your graph',
      busy,
      autoFocus,
      size = 'default',
    },
    forwardedRef,
  ) {
    const reduced = useReducedMotion();
    const inputHeight = INPUT_HEIGHT[size];
    const isTall = size === 'tall';
    const { ref, adjust } = useAutoResize(value, inputHeight.min, inputHeight.max);
    const fileRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement, [ref]);

    const submit = () => {
      onSubmit();
      adjust(true);
    };

    const shownPlaceholder =
      mode === 'web'
        ? webPlaceholder
        : mode === 'research'
          ? researchPlaceholder
          : mode === 'fractal'
            ? fractalPlaceholder
            : placeholder;
    const textareaLabel =
      mode === 'web'
        ? 'Search the web'
        : mode === 'research'
          ? 'Search, then ask Theorem'
          : mode === 'fractal'
            ? 'Search the web from your graph'
            : 'Ask the Theorem agent';

    return (
      <div className="w-full font-sans">
        <div
          className="relative w-full rounded-2xl p-1"
          style={{ background: 'var(--cp-bg)', border: '1px solid var(--cp-border)', boxShadow: 'var(--cp-shadow)' }}
        >
          <div className="relative flex flex-col rounded-xl" style={{ background: 'var(--cp-surface)' }}>
            <div className="relative">
              <textarea
                ref={ref}
                value={value}
                autoFocus={autoFocus}
                placeholder=""
                rows={1}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                aria-label={textareaLabel}
                className={[
                  'w-full resize-none rounded-xl rounded-b-none bg-transparent outline-none',
                  isTall ? 'px-5 py-4 text-[16px] leading-[1.4]' : 'px-4 py-3 text-[15px] leading-[1.35]',
                ].join(' ')}
                style={{ minHeight: inputHeight.min, maxHeight: inputHeight.max, color: 'var(--cp-text)' }}
              />
              {!value ? (
                <div className={isTall ? 'pointer-events-none absolute left-5 top-4' : 'pointer-events-none absolute left-4 top-3'}>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={mode}
                      initial={reduced ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className={isTall ? 'text-[16px]' : 'text-[15px]'}
                      style={{ color: 'var(--cp-text-faint)' }}
                    >
                      {shownPlaceholder}
                    </motion.span>
                  </AnimatePresence>
                </div>
              ) : null}
            </div>

            <div className={isTall ? 'flex h-14 items-center justify-between rounded-b-xl px-3' : 'flex h-12 items-center justify-between rounded-b-xl px-2'}>
              <div className="flex items-center gap-1.5">
                {onAttach ? (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Attach a file"
                      className={isTall ? 'grid h-9 w-9 place-items-center rounded-full transition-colors' : 'grid h-8 w-8 place-items-center rounded-full transition-colors'}
                      style={{ color: 'var(--cp-text-muted)' }}
                    >
                      <Paperclip size={16} />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) onAttach(f);
                        e.target.value = '';
                      }}
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => onModeChange(mode === 'web' ? 'ask' : 'web')}
                  aria-label="Search the web"
                  aria-pressed={mode === 'web'}
                  title="Search the web"
                  className={isTall ? 'flex h-9 items-center gap-1.5 rounded-full border px-2.5 transition-colors' : 'flex h-8 items-center gap-1.5 rounded-full border px-2 transition-colors'}
                  style={
                    mode === 'web'
                      ? { borderColor: 'var(--cp-red)', background: 'var(--cp-red-soft)', color: 'var(--cp-red)' }
                      : { borderColor: 'transparent', color: 'var(--cp-text-muted)' }
                  }
                >
                  <Globe size={16} />
                  <AnimatePresence>
                    {mode === 'web' ? (
                      <motion.span
                        initial={reduced ? false : { width: 0, opacity: 0 }}
                        animate={{ width: 'auto', opacity: 1 }}
                        exit={reduced ? undefined : { width: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em]"
                      >
                        Search
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange(mode === 'research' ? 'ask' : 'research')}
                  aria-label="Search, then ask Theorem"
                  aria-pressed={mode === 'research'}
                  title="Search, then ask Theorem"
                  className={isTall ? 'flex h-9 items-center gap-1.5 rounded-full border px-2.5 transition-colors' : 'flex h-8 items-center gap-1.5 rounded-full border px-2 transition-colors'}
                  style={
                    mode === 'research'
                      ? { borderColor: 'var(--cp-red)', background: 'var(--cp-red-soft)', color: 'var(--cp-red)' }
                      : { borderColor: 'transparent', color: 'var(--cp-text-muted)' }
                  }
                >
                  <Sparkles size={16} />
                  <AnimatePresence>
                    {mode === 'research' ? (
                      <motion.span
                        initial={reduced ? false : { width: 0, opacity: 0 }}
                        animate={{ width: 'auto', opacity: 1 }}
                        exit={reduced ? undefined : { width: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em]"
                      >
                        Research
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
                <button
                  type="button"
                  onClick={() => onModeChange(mode === 'fractal' ? 'ask' : 'fractal')}
                  aria-label="Fractal expansion"
                  aria-pressed={mode === 'fractal'}
                  title="Search the web from your graph"
                  className={isTall ? 'flex h-9 items-center gap-1.5 rounded-full border px-2.5 transition-colors' : 'flex h-8 items-center gap-1.5 rounded-full border px-2 transition-colors'}
                  style={
                    mode === 'fractal'
                      ? { borderColor: 'var(--cp-teal)', background: 'rgba(34, 105, 115, 0.12)', color: 'var(--cp-teal)' }
                      : { borderColor: 'transparent', color: 'var(--cp-text-muted)' }
                  }
                >
                  <GitBranch size={16} />
                  <AnimatePresence>
                    {mode === 'fractal' ? (
                      <motion.span
                        initial={reduced ? false : { width: 0, opacity: 0 }}
                        animate={{ width: 'auto', opacity: 1 }}
                        exit={reduced ? undefined : { width: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.08em]"
                      >
                        Fractal expansion
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </button>
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                aria-label={mode === 'ask' || mode === 'research' ? 'Ask' : 'Search'}
                className={isTall ? 'grid h-9 w-9 place-items-center rounded-full transition-colors' : 'grid h-8 w-8 place-items-center rounded-full transition-colors'}
                style={
                  value && !busy
                    ? { background: 'var(--cp-red)', color: '#fff' }
                    : { background: 'var(--cp-surface-hover)', color: 'var(--cp-text-faint)' }
                }
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
