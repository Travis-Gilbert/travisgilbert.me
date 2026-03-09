'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useFloating, flip, shift, offset } from '@floating-ui/react';
import type { ContentSearchResult } from '@/lib/studio-api';
import { getContentTypeIdentity } from '@/lib/studio';

export interface MentionPopupRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface MentionPopupProps {
  items: ContentSearchResult[];
  referenceRect: DOMRect | null;
  command: (item: ContentSearchResult) => void;
  onClose: () => void;
}

const MentionPopup = forwardRef<MentionPopupRef, MentionPopupProps>(
  ({ items, referenceRect, command, onClose }, ref) => {
    const [activeIndex, setActiveIndex] = useState(0);

    const { refs, floatingStyles } = useFloating({
      strategy: 'fixed',
      placement: 'bottom-start',
      middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    });

    // Sync virtual reference from cursor rect
    useEffect(() => {
      if (referenceRect) {
        refs.setReference({
          getBoundingClientRect: () => referenceRect,
        });
      }
    }, [referenceRect, refs]);

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
          ref={refs.setFloating}
          style={floatingStyles}
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
        ref={refs.setFloating}
        style={floatingStyles}
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
