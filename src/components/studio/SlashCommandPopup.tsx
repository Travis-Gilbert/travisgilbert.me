'use client';

import { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import type { SlashCommandItem } from './extensions/SlashCommand';

interface SlashCommandPopupProps {
  items: SlashCommandItem[];
  position: { x: number; y: number };
  command: (item: SlashCommandItem) => void;
  onClose: () => void;
}

export interface SlashCommandPopupRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

const SlashCommandPopup = forwardRef<SlashCommandPopupRef, SlashCommandPopupProps>(
  function SlashCommandPopup({ items, position, command, onClose }, ref) {
    const [activeIndex, setActiveIndex] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset active index when items change
    useEffect(() => {
      setActiveIndex(0);
    }, [items]);

    // Scroll active item into view
    useEffect(() => {
      const active = listRef.current?.querySelector('.is-active');
      active?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
          return true;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
          return true;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          selectItem(activeIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return null;
    }

    // Group items by section (preserving order)
    const sections: { name: string; items: { item: SlashCommandItem; globalIndex: number }[] }[] = [];
    let currentSection = '';
    items.forEach((item, i) => {
      if (item.section !== currentSection) {
        currentSection = item.section;
        sections.push({ name: item.section, items: [] });
      }
      sections[sections.length - 1].items.push({ item, globalIndex: i });
    });

    return (
      <div
        className="studio-slash-popup"
        style={{ left: position.x, top: position.y }}
        ref={listRef}
      >
        {sections.map((section) => (
          <div key={section.name}>
            <div className="studio-slash-section">{section.name}</div>
            {section.items.map(({ item, globalIndex }) => (
              <button
                type="button"
                key={item.title}
                className={`studio-slash-item${globalIndex === activeIndex ? ' is-active' : ''}`}
                onClick={() => selectItem(globalIndex)}
                onMouseEnter={() => setActiveIndex(globalIndex)}
              >
                <span className="studio-slash-icon">{item.icon}</span>
                <div>
                  <div className="studio-slash-title">{item.title}</div>
                  <div className="studio-slash-desc">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  },
);

export default SlashCommandPopup;
