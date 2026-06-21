'use client';

/**
 * The omnibar input, ported from the 21st.dev reuno-ui/ai-input component and
 * re-tokenized to the CommonPlace --cp-* language: an auto-resizing textarea
 * with an attach affordance, a search/web toggle, and a send button. It reads
 * as a chat bar (Travis's ask) -- larger than a command pill. The omnibar wires
 * it to Theorem's agent (askAgent) on submit and to RustyRed search when the
 * toggle is on.
 *
 * Radius note: keeps the rounded chat-bar shape (a deliberate exception to the
 * otherwise-sharp design language, per request).
 */

import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Globe, Paperclip, ArrowUp } from 'lucide-react';

const MIN_HEIGHT = 52;
const MAX_HEIGHT = 168;

function useAutoResize(value: string) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const adjust = React.useCallback((reset?: boolean) => {
    const el = ref.current;
    if (!el) return;
    el.style.height = `${MIN_HEIGHT}px`;
    if (reset) return;
    el.style.height = `${Math.max(MIN_HEIGHT, Math.min(el.scrollHeight, MAX_HEIGHT))}px`;
  }, []);
  React.useEffect(() => {
    adjust();
  }, [value, adjust]);
  return { ref, adjust };
}

export interface AiInputBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  searchOn: boolean;
  onToggleSearch: () => void;
  onAttach?: (file: File) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  busy?: boolean;
  autoFocus?: boolean;
}

export const AiInputBar = React.forwardRef<HTMLTextAreaElement, AiInputBarProps>(
  function AiInputBar(
    {
      value,
      onChange,
      onSubmit,
      searchOn,
      onToggleSearch,
      onAttach,
      placeholder = 'Ask the agent, or search',
      searchPlaceholder = 'Search the substrate',
      busy,
      autoFocus,
    },
    forwardedRef,
  ) {
    const reduced = useReducedMotion();
    const { ref, adjust } = useAutoResize(value);
    const fileRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(forwardedRef, () => ref.current as HTMLTextAreaElement, [ref]);

    const submit = () => {
      onSubmit();
      adjust(true);
    };

    const shownPlaceholder = searchOn ? searchPlaceholder : placeholder;

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
                aria-label={searchOn ? 'Search the substrate' : 'Ask the agent or search'}
                className="w-full resize-none rounded-xl rounded-b-none bg-transparent px-4 py-3 text-[15px] leading-[1.35] outline-none"
                style={{ minHeight: MIN_HEIGHT, maxHeight: MAX_HEIGHT, color: 'var(--cp-text)' }}
              />
              {!value ? (
                <div className="pointer-events-none absolute left-4 top-3">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={searchOn ? 'search' : 'ask'}
                      initial={reduced ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="text-[15px]"
                      style={{ color: 'var(--cp-text-faint)' }}
                    >
                      {shownPlaceholder}
                    </motion.span>
                  </AnimatePresence>
                </div>
              ) : null}
            </div>

            <div className="flex h-12 items-center justify-between rounded-b-xl px-2">
              <div className="flex items-center gap-1.5">
                {onAttach ? (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Attach a file"
                      className="grid h-8 w-8 place-items-center rounded-full transition-colors"
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
                  onClick={onToggleSearch}
                  aria-pressed={searchOn}
                  className="flex h-8 items-center gap-1.5 rounded-full border px-2 transition-colors"
                  style={
                    searchOn
                      ? { borderColor: 'var(--cp-red)', background: 'var(--cp-red-soft)', color: 'var(--cp-red)' }
                      : { borderColor: 'transparent', color: 'var(--cp-text-muted)' }
                  }
                >
                  <Globe size={16} />
                  <AnimatePresence>
                    {searchOn ? (
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
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={busy}
                aria-label={searchOn ? 'Search' : 'Ask'}
                className="grid h-8 w-8 place-items-center rounded-full transition-colors"
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
