'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getContentTypeIdentity } from '@/lib/studio';

interface MentionTooltipData {
  id: string;
  title: string;
  contentType: string;
  slug: string;
  excerpt?: string;
  stage?: string;
  wordCount?: number;
}

export default function MentionTooltip({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [data, setData] = useState<MentionTooltipData | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback((e: MouseEvent) => {
    const target = (e.target as HTMLElement).closest('.studio-mention') as HTMLElement | null;
    if (!target) return;

    const mentionId = target.getAttribute('data-mention-id') || '';
    const mentionType = target.getAttribute('data-mention-type') || '';
    const label = target.textContent?.replace(/^@/, '') || '';

    const rect = target.getBoundingClientRect();
    setPosition({ x: rect.left + rect.width / 2, y: rect.top });
    setData({
      id: mentionId,
      title: label,
      contentType: mentionType,
      slug: mentionId.split(':')[1] || '',
    });

    timeoutRef.current = setTimeout(() => setVisible(true), 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
    setData(null);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseover', handleMouseEnter);
    container.addEventListener('mouseout', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseover', handleMouseEnter);
      container.removeEventListener('mouseout', handleMouseLeave);
    };
  }, [containerRef, handleMouseEnter, handleMouseLeave]);

  if (!visible || !data) return null;

  const typeInfo = getContentTypeIdentity(data.contentType);

  return (
    <div
      className="studio-mention-tooltip"
      style={{
        top: position.y,
        left: position.x,
      }}
    >
      <div className="studio-mention-tooltip-header">
        <span
          className="studio-mention-tooltip-dot"
          style={{ backgroundColor: typeInfo.color }}
        />
        <span className="studio-mention-tooltip-type">{typeInfo.label}</span>
      </div>
      <div className="studio-mention-tooltip-title">{data.title}</div>
      {data.excerpt && (
        <div className="studio-mention-tooltip-excerpt">{data.excerpt}</div>
      )}
    </div>
  );
}
