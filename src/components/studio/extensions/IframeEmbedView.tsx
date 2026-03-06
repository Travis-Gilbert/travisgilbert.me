'use client';

import { NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';

function normalizeEmbedUrl(url: string): string {
  // Observable: convert page URL to embed URL
  const obsMatch = url.match(/^https:\/\/observablehq\.com\/([@d].*)$/);
  if (obsMatch && !url.includes('/embed/')) {
    return `https://observablehq.com/embed/${obsMatch[1]}`;
  }
  return url;
}

export default function IframeEmbedView({ node, updateAttributes }: NodeViewProps) {
  const rawSrc = node.attrs.src as string;
  const src = normalizeEmbedUrl(rawSrc);
  const height = (node.attrs.height as number) || 480;
  const [isResizing, setIsResizing] = useState(false);
  const startRef = useRef<{ y: number; height: number } | null>(null);

  let domain = '';
  try {
    domain = new URL(src).hostname;
  } catch {
    domain = src;
  }

  const isObservable = domain.includes('observablehq.com');
  const isSelfHosted = src.startsWith('/') || domain.includes('travisgilbert');

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      startRef.current = { y: e.clientY, height };
      setIsResizing(true);

      const onMouseMove = (ev: MouseEvent) => {
        if (!startRef.current) return;
        const delta = ev.clientY - startRef.current.y;
        const newHeight = Math.max(200, Math.min(1200, startRef.current.height + delta));
        updateAttributes({ height: newHeight });
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
    [height, updateAttributes],
  );

  return (
    <NodeViewWrapper className="studio-iframe-wrapper" data-iframe-embed="true">
      <div className="studio-iframe-header" contentEditable={false}>
        <span className="studio-iframe-badge">
          {isObservable ? 'OBSERVABLE' : isSelfHosted ? 'D3 CHART' : 'EMBED'}
        </span>
        <span className="studio-iframe-domain">{domain}</span>
      </div>
      <div
        className="studio-iframe-container"
        style={{ height: `${height}px` }}
      >
        <iframe
          src={src}
          style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0 0 8px 8px' }}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
          allowFullScreen
        />
      </div>
      <div
        className="studio-iframe-resize"
        contentEditable={false}
        onMouseDown={onMouseDown}
        title="Drag to resize"
      />
    </NodeViewWrapper>
  );
}
