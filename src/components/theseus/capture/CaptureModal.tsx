'use client';

import { useCallback, useState } from 'react';
import { Drawer } from 'vaul';
import DropZone from './DropZone';
import UploadQueue from './UploadQueue';
import FilePreview from './FilePreview';
import { captureText } from './captureApi';
import type { CaptureResult } from './captureApi';
import './capture.css';

interface CaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Files pre-loaded via global drop */
  initialFiles?: File[];
}

export default function CaptureModal({
  open,
  onOpenChange,
  initialFiles,
}: CaptureModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [textValue, setTextValue] = useState('');
  const [textCapturing, setTextCapturing] = useState(false);
  const [textResult, setTextResult] = useState<{ result?: CaptureResult; error?: string } | null>(null);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const handleUrlCaptured = useCallback(async (url: string) => {
    setTextValue(url);
    setTextCapturing(true);
    const result = await captureText(url);
    setTextCapturing(false);
    if (result.ok) {
      setTextResult({ result });
    } else {
      setTextResult({ error: result.error });
    }
  }, []);

  const handleTextCapture = useCallback(async () => {
    const content = textValue.trim();
    if (!content) return;

    setTextCapturing(true);
    const result = await captureText(content);
    setTextCapturing(false);

    if (result.ok) {
      setTextResult({ result });
      setTextValue('');
    } else {
      setTextResult({ error: result.error });
    }
  }, [textValue]);

  const handleUploadComplete = useCallback(() => {
    setFiles([]);
    // Keep modal open so user sees the summary
  }, []);

  const handleClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      // Reset state on close
      setFiles([]);
      setTextValue('');
      setTextResult(null);
      setTextCapturing(false);
    }
    onOpenChange(nextOpen);
  }, [onOpenChange]);

  // Create a dummy File for text capture preview display
  const textPreviewFile = textResult
    ? new File([''], textResult.result?.object?.title ?? 'text capture', { type: 'text/plain' })
    : null;

  return (
    <Drawer.Root open={open} onOpenChange={handleClose}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 90,
          }}
        />
        <Drawer.Content
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            maxHeight: '85vh',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            background: 'rgba(15,16,18,0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
            zIndex: 91,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Drag handle */}
          <div style={{ padding: '12px 0 0', flexShrink: 0 }}>
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: 'var(--vie-text-dim)',
                margin: '0 auto',
              }}
            />
          </div>

          {/* Content area */}
          <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div>
              <Drawer.Title style={{
                margin: 0,
                fontFamily: 'var(--vie-font-title)',
                fontSize: 20,
                fontWeight: 400,
                color: 'var(--vie-text)',
              }}>
                Add to your graph
              </Drawer.Title>
              <p style={{
                margin: '6px 0 0',
                fontFamily: 'var(--vie-font-mono)',
                fontSize: 11,
                color: 'var(--vie-text-muted)',
              }}>
                Drop files, paste URLs, or type notes
              </p>
            </div>

            {/* DropZone */}
            <DropZone
              onFilesSelected={handleFilesSelected}
              onUrlCaptured={handleUrlCaptured}
              initialFiles={initialFiles}
            />

            {/* Text/URL input */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="Paste a URL or type a note..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(15,16,18,0.76)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(244,243,240,0.08)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 13,
                  color: 'var(--vie-text)',
                  resize: 'vertical',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(74,138,150,0.4)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(244,243,240,0.08)'; }}
              />
              <button
                type="button"
                onClick={handleTextCapture}
                disabled={!textValue.trim() || textCapturing}
                style={{
                  alignSelf: 'flex-end',
                  padding: '6px 16px',
                  borderRadius: 8,
                  background: textValue.trim() && !textCapturing ? 'var(--vie-teal)' : 'rgba(45,95,107,0.3)',
                  border: 'none',
                  color: 'var(--vie-text)',
                  fontFamily: 'var(--vie-font-mono)',
                  fontSize: 12,
                  cursor: textValue.trim() && !textCapturing ? 'pointer' : 'default',
                  opacity: textValue.trim() && !textCapturing ? 1 : 0.5,
                }}
              >
                {textCapturing ? 'Capturing...' : 'Capture'}
              </button>
            </div>

            {/* Text capture result */}
            {textResult && textPreviewFile && (
              <FilePreview
                file={textPreviewFile}
                result={textResult.result}
                status={textResult.result ? 'complete' : 'error'}
                error={textResult.error}
                onRemove={() => setTextResult(null)}
              />
            )}

            {/* Upload queue (files) */}
            {files.length > 0 && (
              <UploadQueue
                files={files}
                onComplete={handleUploadComplete}
              />
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
