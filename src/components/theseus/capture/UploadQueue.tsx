'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import FilePreview from './FilePreview';
import { captureFile, captureBatch, pollBatchStatus } from './captureApi';
import { MAX_BATCH_SIZE } from './fileTypes';
import type { CaptureResult } from './captureApi';

type ItemStatus = 'pending' | 'uploading' | 'processing' | 'complete' | 'error';

interface QueueItem {
  file: File;
  status: ItemStatus;
  result?: CaptureResult;
  error?: string;
}

interface UploadQueueProps {
  files: File[];
  onComplete: (results: CaptureResult[]) => void;
}

export default function UploadQueue({ files, onComplete }: UploadQueueProps) {
  const [items, setItems] = useState<QueueItem[]>(() =>
    files.map((file) => ({ file, status: 'pending' as const })),
  );
  const [cancelled, setCancelled] = useState(false);
  const cancelledRef = useRef(false);
  const uploadingRef = useRef(false);

  // Sync cancelled state to ref for access in async loop
  useEffect(() => { cancelledRef.current = cancelled; }, [cancelled]);

  // Update items when files prop changes (new files added)
  useEffect(() => {
    setItems((prev) => {
      const existingNames = new Set(prev.map((i) => i.file.name + i.file.size));
      const newItems = files
        .filter((f) => !existingNames.has(f.name + f.size))
        .map((file) => ({ file, status: 'pending' as const }));
      return newItems.length > 0 ? [...prev, ...newItems] : prev;
    });
  }, [files]);

  const updateItem = useCallback((index: number, update: Partial<QueueItem>) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, ...update } : item));
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Sequential upload loop
  useEffect(() => {
    if (uploadingRef.current) return;

    async function uploadSequentially() {
      uploadingRef.current = true;

      // If more than MAX_BATCH_SIZE, use batch endpoint
      const pendingCount = items.filter((i) => i.status === 'pending').length;
      if (pendingCount > MAX_BATCH_SIZE) {
        await handleBatchUpload();
        uploadingRef.current = false;
        return;
      }

      for (let i = 0; i < items.length; i++) {
        if (cancelledRef.current) break;
        if (items[i].status !== 'pending') continue;

        updateItem(i, { status: 'uploading' });

        const result = await captureFile(items[i].file);

        if (cancelledRef.current) break;

        if (result.ok) {
          updateItem(i, { status: 'complete', result });
        } else {
          updateItem(i, { status: 'error', error: result.error });
        }
      }

      uploadingRef.current = false;
    }

    async function handleBatchUpload() {
      const pendingFiles = items.filter((i) => i.status === 'pending').map((i) => i.file);

      // Mark all as uploading
      setItems((prev) => prev.map((item) =>
        item.status === 'pending' ? { ...item, status: 'uploading' as const } : item,
      ));

      const result = await captureBatch(pendingFiles);

      if (!result.ok) {
        setItems((prev) => prev.map((item) =>
          item.status === 'uploading' ? { ...item, status: 'error' as const, error: result.error } : item,
        ));
        return;
      }

      // Mark as processing and poll
      setItems((prev) => prev.map((item) =>
        item.status === 'uploading' ? { ...item, status: 'processing' as const } : item,
      ));

      // Poll until complete
      const taskId = result.task_id;
      let attempts = 0;
      while (attempts < 120) {
        if (cancelledRef.current) break;
        await new Promise((r) => setTimeout(r, 2000));
        const status = await pollBatchStatus(taskId);
        if (!status.ok) break;
        if (status.status === 'complete' || status.status === 'failed') {
          setItems((prev) => prev.map((item) =>
            item.status === 'processing'
              ? { ...item, status: status.status === 'complete' ? 'complete' as const : 'error' as const }
              : item,
          ));
          break;
        }
        attempts++;
      }
    }

    const hasPending = items.some((i) => i.status === 'pending');
    if (hasPending && !cancelledRef.current) {
      uploadSequentially();
    }
  }, [items, updateItem, cancelled]);

  const completedCount = items.filter((i) => i.status === 'complete').length;
  const errorCount = items.filter((i) => i.status === 'error').length;
  const allDone = items.every((i) => i.status === 'complete' || i.status === 'error');

  const handleDone = useCallback(() => {
    const results = items
      .filter((i): i is QueueItem & { result: CaptureResult } => i.status === 'complete' && !!i.result)
      .map((i) => i.result);
    onComplete(results);
  }, [items, onComplete]);

  const handleCancel = useCallback(() => {
    setCancelled(true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Aggregate progress */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--vie-font-mono)',
          fontSize: 12,
          color: 'var(--vie-text-dim)',
        }}>
          {allDone
            ? `${completedCount} of ${items.length} files processed`
            : `${completedCount} of ${items.length} files uploaded`
          }
        </span>

        {!allDone && !cancelled && (
          <button
            type="button"
            onClick={handleCancel}
            style={{
              background: 'none',
              border: '1px solid rgba(196,80,60,0.3)',
              borderRadius: 6,
              padding: '4px 10px',
              color: 'var(--vie-terra-light)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>

      {/* File preview cards */}
      {items.map((item, index) => (
        <FilePreview
          key={`${item.file.name}-${item.file.size}`}
          file={item.file}
          result={item.result}
          status={item.status}
          error={item.error}
          onRemove={() => removeItem(index)}
        />
      ))}

      {/* Summary when done */}
      {allDone && items.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          padding: '12px 0',
        }}>
          {completedCount > 0 && (
            <span style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 12,
              color: 'var(--vie-teal-light)',
            }}>
              {completedCount} file{completedCount !== 1 ? 's' : ''} added to your graph
            </span>
          )}
          {errorCount > 0 && (
            <span style={{
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 12,
              color: 'var(--vie-terra-light)',
            }}>
              {errorCount} file{errorCount !== 1 ? 's' : ''} failed
            </span>
          )}
          <button
            type="button"
            onClick={handleDone}
            style={{
              alignSelf: 'flex-start',
              padding: '8px 20px',
              borderRadius: 8,
              background: 'var(--vie-teal)',
              border: 'none',
              color: 'var(--vie-text)',
              fontFamily: 'var(--vie-font-mono)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
