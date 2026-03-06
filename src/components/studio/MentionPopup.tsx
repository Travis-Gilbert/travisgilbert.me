'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import type { ContentSearchResult } from '@/lib/studio-api';
import { getContentTypeIdentity } from '@/lib/studio';

export interface MentionPopupRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface MentionPopupProps {
  items: ContentSearchResult[];
  position: { x: number; y: number };
  command: (item: ContentSearchResult) => void;
  onClose: () => void;
}

const MentionPopup = forwardRef<MentionPopupRef, MentionPopupProps>(
  ({ items, position, command, onClose }, ref) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      setActiveIndex(0);
    }, [items]);

    useImperativeHandle(ref, () => ({
      onKeyDown(event: KeyboardEvent) {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, items.length - 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
          return true;
        }
        if (event.key === 'Enter' && items.length > 0) {
          event.preventDefault();
          command(items[activeIndex]);
          return true;
        }
        if (event.key === 'Escape') {
          onClose();
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className="studio-mention-popup"
          style={{
            top: position.y + 24,
            left: Math.min(position.x, window.innerWidth - 340),
          }}
        >
          <div
            style={{
              padding: '10px 12px',
              color: 'var(--studio-text-3)',
              fontFamily: 'var(--studio-font-body)',
              fontSize: '12px',
            }}
          >
            No results. Keep typing...
          </div>
        </div>
      );
    }

    return (
      <div
        className="studio-mention-popup"
        ref={listRef}
        style={{
          top: position.y + 24,
          left: Math.min(position.x, window.innerWidth - 340),
        }}
      >
        {items.slice(0, 10).map((item, index) => {
          const identity = getContentTypeIdentity(item.contentType);
          return (
            <button
              key={item.id}
              type="button"
              className={`studio-mention-item ${index === activeIndex ? 'is-active' : ''}`}
              onClick={() => command(item)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span
                className="studio-mention-item-dot"
                style={{ backgroundColor: identity.color }}
              />
              <span className="studio-mention-item-title">{item.label}</span>
              <span className="studio-mention-item-type">
                {item.contentType}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionPopup.displayName = 'MentionPopup';

export default MentionPopup;
