'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CapturedObject } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import {
  createCapturedObject,
  inferTypeFromDrop,
  inferTypeFromFile,
  readFileAsText,
} from '@/lib/commonplace-capture';

/**
 * DropZone: full-screen drag-and-drop overlay.
 *
 * When the user drags content over the CommonPlace layout, this
 * overlay appears with a dashed border and "digitize" prompt.
 * On drop, the content is captured as a new object with a
 * brief "absorb" animation (dot shrinks into sidebar).
 *
 * Renders as a portal-style overlay on the layout root.
 * The parent component should place this at the top level of
 * the CommonPlace layout.
 */

interface DropZoneProps {
  onCapture: (object: CapturedObject) => void;
}

export default function DropZone({ onCapture }: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [absorbLabel, setAbsorbLabel] = useState('');
  const [dragCounter, setDragCounter] = useState(0);

  /* Track drag enter/leave with a counter because child elements
     fire their own dragenter/dragleave events. This is the standard
     workaround for the "flickering overlay" problem. */

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragCounter((c) => {
      if (c === 0) setIsDragActive(true);
      return c + 1;
    });
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) {
        setIsDragActive(false);
        return 0;
      }
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      setDragCounter(0);

      if (!e.dataTransfer) return;

      /* Extract drop info synchronously (DataTransfer only lives during the event).
         The File reference persists, so we can read it asynchronously below. */
      const dropInfo = inferTypeFromDrop(e.dataTransfer);

      const processCapture = async () => {
        let object: CapturedObject;

        if (dropInfo.type === 'file' && dropInfo.file) {
          const fileType = inferTypeFromFile(dropInfo.file);
          /* Read text content for text-based files (.md, .txt, .json, etc.).
             Returns null for binary files (PDFs, images). */
          const textContent = await readFileAsText(dropInfo.file);
          object = createCapturedObject({
            text: textContent ?? dropInfo.file.name,
            objectType: fileType,
            captureMethod: 'dropped',
          });
          object.title = dropInfo.file.name;
        } else {
          object = createCapturedObject({
            text: dropInfo.content,
            captureMethod: 'dropped',
            sourceUrl: dropInfo.type === 'url' ? dropInfo.content : undefined,
          });
        }

        /* Show absorb animation */
        const typeInfo = getObjectTypeIdentity(object.objectType);
        setAbsorbLabel(typeInfo.label);
        setIsAbsorbing(true);

        /* Deliver the object after a brief animation delay */
        setTimeout(() => {
          onCapture(object);
          setIsAbsorbing(false);
          setAbsorbLabel('');
        }, 600);
      };

      processCapture();
    },
    [onCapture]
  );

  /* Attach drag listeners to the document so the overlay
     appears regardless of where the user starts dragging */
  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  /* Absorb animation overlay */
  if (isAbsorbing) {
    return (
      <div className="cp-dropzone-overlay" data-active="true" aria-hidden="true">
        <div className="cp-absorb-dot" aria-hidden="true">
          <span
            style={{
              fontFamily: 'var(--cp-font-mono)',
              fontSize: 11,
              color: 'var(--cp-text)',
              letterSpacing: '0.05em',
            }}
          >
            {absorbLabel} captured
          </span>
        </div>
      </div>
    );
  }

  /* Drag active overlay */
  if (!isDragActive) return null;

  return (
    <div className="cp-dropzone-overlay" data-active="true">
      <div className="cp-dropzone-inner">
        <svg
          width={32}
          height={32}
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--cp-terracotta)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.7 }}
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 13,
            letterSpacing: '0.08em',
            color: 'var(--cp-text-muted)',
            marginTop: 12,
          }}
        >
          DROP TO CAPTURE
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint)',
            marginTop: 4,
          }}
        >
          URLs, text, or files
        </div>
      </div>
    </div>
  );
}
