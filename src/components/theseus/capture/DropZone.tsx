'use client';

import { useCallback, useRef, useState } from 'react';
import { ACCEPT_STRING, validateFile } from './fileTypes';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  onUrlCaptured?: (url: string) => void;
  disabled?: boolean;
  /** Pre-loaded files (from global drop). Consumed once on mount. */
  initialFiles?: File[];
}

export default function DropZone({
  onFilesSelected,
  onUrlCaptured,
  disabled,
  initialFiles,
}: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const consumedInitial = useRef(false);

  // If initialFiles were passed (from global drop), process them once
  if (initialFiles && initialFiles.length > 0 && !consumedInitial.current) {
    consumedInitial.current = true;
    // Schedule to avoid calling during render
    queueMicrotask(() => processFiles(initialFiles));
  }

  const processFiles = useCallback((fileList: File[]) => {
    const valid: File[] = [];
    const errs: string[] = [];

    for (const file of fileList) {
      const result = validateFile(file);
      if (result.valid) {
        valid.push(file);
      } else {
        errs.push(`${file.name}: ${result.error}`);
      }
    }

    setErrors(errs);
    if (valid.length > 0) onFilesSelected(valid);
  }, [onFilesSelected]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    // Check for dropped text (URL)
    const text = e.dataTransfer.getData('text/plain');
    if (text && /^https?:\/\//.test(text.trim())) {
      onUrlCaptured?.(text.trim());
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFiles(files);
  }, [processFiles, onUrlCaptured]);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processFiles(files);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }, [processFiles]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `1px dashed ${dragOver ? 'rgba(74,138,150,0.6)' : 'rgba(74,138,150,0.3)'}`,
        background: dragOver ? 'rgba(45,95,107,0.08)' : 'rgba(45,95,107,0.04)',
        borderRadius: 12,
        minHeight: 200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 24,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Upload icon */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ color: 'var(--vie-teal-light)' }}
      >
        <path
          d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 8l-5-5-5 5M12 3v12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <span style={{
        fontFamily: 'var(--vie-font-body)',
        fontSize: 15,
        color: 'var(--vie-text)',
      }}>
        Drop files here
      </span>

      <span style={{
        fontFamily: 'var(--vie-font-mono)',
        fontSize: 12,
        color: 'var(--vie-text-muted)',
      }}>
        or click to browse
      </span>

      <span style={{
        fontFamily: 'var(--vie-font-mono)',
        fontSize: 10,
        color: 'var(--vie-text-dim)',
      }}>
        PDF, DOCX, XLSX, PPTX, code, images, text
      </span>

      {errors.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {errors.map((err) => (
            <span key={err} style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 12,
              color: 'var(--vie-terra-light)',
            }}>
              {err}
            </span>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
    </div>
  );
}
