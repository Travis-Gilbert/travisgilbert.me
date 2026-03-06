'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';

export default function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const src = node.attrs.src as string;
  const width = (node.attrs.width as number) || undefined;
  const align = (node.attrs.align as string) || 'center';
  const [isResizing, setIsResizing] = useState(false);
  const startRef = useRef<{ x: number; width: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const currentWidth = imgRef.current?.offsetWidth || 400;
      startRef.current = { x: e.clientX, width: currentWidth };
      setIsResizing(true);

      const onMouseMove = (ev: MouseEvent) => {
        if (!startRef.current) return;
        const delta = ev.clientX - startRef.current.x;
        const newWidth = Math.max(100, startRef.current.width + delta);
        updateAttributes({ width: Math.round(newWidth) });
      };

      const onMouseUp = () => {
        setIsResizing(false);
        startRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [updateAttributes],
  );

  const alignStyle: React.CSSProperties = {
    marginLeft: align === 'center' ? 'auto' : align === 'right' ? 'auto' : '0',
    marginRight: align === 'center' ? 'auto' : align === 'left' ? 'auto' : '0',
  };

  return (
    <NodeViewWrapper
      className={`studio-resizable-image ${selected ? 'is-selected' : ''} ${isResizing ? 'is-resizing' : ''}`}
      style={alignStyle}
      data-align={align}
    >
      <div className="studio-resizable-image-container" style={{ width: width ? `${width}px` : '100%' }}>
        <img
          ref={imgRef}
          src={src}
          alt={node.attrs.alt || ''}
          className="studio-resizable-image-el"
          draggable={false}
        />
        {/* Resize handle (bottom-right corner) */}
        <div
          className="studio-image-resize-handle"
          contentEditable={false}
          onMouseDown={onMouseDown}
        />
        {/* Alignment controls (visible when selected) */}
        {selected && (
          <div className="studio-image-align-bar" contentEditable={false}>
            {(['left', 'center', 'right'] as const).map((a) => (
              <button
                key={a}
                type="button"
                className={`studio-image-align-btn ${align === a ? 'is-active' : ''}`}
                onClick={() => updateAttributes({ align: a })}
                title={`Align ${a}`}
              >
                {a === 'left' ? '\u2190' : a === 'right' ? '\u2192' : '\u2194'}
              </button>
            ))}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
