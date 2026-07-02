'use client';

import Image from 'next/image';
import type { ChangeEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Globe, Paperclip, Plus, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import styles from './AgentThreadOmnibar.module.css';

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

interface AgentThreadOmnibarProps {
  busy?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (options: { webSearch: boolean; file?: File }) => void | Promise<void>;
}

const MIN_HEIGHT = 48;
const MAX_HEIGHT = 164;

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = `${minHeight}px`;
      if (reset) return;

      const nextHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );
      textarea.style.height = `${nextHeight}px`;
    },
    [maxHeight, minHeight],
  );

  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

function AnimatedPlaceholder({
  placeholder,
  showSearch,
}: {
  placeholder: string;
  showSearch: boolean;
}) {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={showSearch ? 'search' : 'ask'}
        initial={reduced ? false : { opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduced ? undefined : { opacity: 0, y: -5 }}
        transition={{ duration: 0.1 }}
        className={styles.placeholder}
      >
        {showSearch ? 'Search the web...' : placeholder}
      </motion.p>
    </AnimatePresence>
  );
}

export default function AgentThreadOmnibar({
  busy = false,
  placeholder = 'Ask CommonPlace...',
  value,
  onChange,
  onSubmit,
}: AgentThreadOmnibarProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
  });

  useEffect(() => {
    adjustHeight(!value);
  }, [adjustHeight, value]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  function clearAttachment(event?: MouseEvent<HTMLButtonElement>) {
    event?.preventDefault();
    event?.stopPropagation();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setAttachedFile(undefined);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setAttachedFile(file);
    setImagePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit() {
    if (!value.trim() || busy) return;
    await onSubmit({ webSearch: showSearch, file: attachedFile });
    adjustHeight(true);
    clearAttachment();
  }

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <div className={styles.shell}>
          <div className={styles.scrollArea} style={{ maxHeight: `${MAX_HEIGHT}px` }}>
            <div className={styles.inputLayer}>
              <textarea
                ref={textareaRef}
                id="commonplace-agent-input"
                value={value}
                placeholder=""
                className={styles.textarea}
                rows={1}
                aria-label="Message CommonPlace"
                disabled={busy}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                onChange={(event) => {
                  onChange(event.target.value);
                  adjustHeight();
                }}
              />
              {!value ? (
                <div className={styles.placeholderWrap}>
                  <AnimatedPlaceholder placeholder={placeholder} showSearch={showSearch} />
                </div>
              ) : null}
            </div>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.leftTools}>
              <label
                className={cn(styles.iconTool, attachedFile && styles.iconToolActive)}
                title="Attach file"
                aria-label="Attach file"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={busy}
                />
                <Paperclip size={16} />
                {attachedFile ? (
                  <span className={styles.fileName}>{attachedFile.name}</span>
                ) : null}
                {imagePreview ? (
                  <span className={styles.preview}>
                    <Image
                      src={imagePreview}
                      alt="Attached image preview"
                      fill
                      sizes="100px"
                      unoptimized
                      className={styles.previewImage}
                    />
                    <button
                      type="button"
                      onClick={clearAttachment}
                      className={styles.previewClose}
                      aria-label="Remove attachment"
                      title="Remove attachment"
                    >
                      <Plus size={16} />
                    </button>
                  </span>
                ) : null}
              </label>

              <button
                type="button"
                onClick={() => setShowSearch((current) => !current)}
                className={cn(styles.searchTool, showSearch && styles.searchToolActive)}
                aria-label="Search the web"
                aria-pressed={showSearch}
                title="Search the web"
                disabled={busy}
              >
                <motion.span
                  className={styles.searchIcon}
                  animate={{ rotate: showSearch ? 180 : 0, scale: showSearch ? 1.08 : 1 }}
                  whileHover={{ rotate: showSearch ? 180 : 15, scale: 1.08 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 25 }}
                >
                  <Globe size={16} />
                </motion.span>
                <AnimatePresence>
                  {showSearch ? (
                    <motion.span
                      initial={{ width: 0, opacity: 0 }}
                      animate={{ width: 'auto', opacity: 1 }}
                      exit={{ width: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={styles.searchLabel}
                    >
                      Search
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              className={cn(styles.sendButton, value.trim() && styles.sendButtonActive)}
              aria-label={busy ? 'Sending message' : 'Send message'}
              title="Send message"
              disabled={!value.trim() || busy}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
