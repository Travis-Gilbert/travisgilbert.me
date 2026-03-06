'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { CONTAIN_TYPES } from './ContainBlock';
import type { ContainType } from './ContainBlock';

const CONTAIN_META: Record<
  ContainType,
  { label: string; colorVar: string }
> = {
  observation: { label: 'Observation', colorVar: '--studio-contain-observation' },
  argument: { label: 'Argument', colorVar: '--studio-contain-argument' },
  evidence: { label: 'Evidence', colorVar: '--studio-contain-evidence' },
  question: { label: 'Question', colorVar: '--studio-contain-question' },
  aside: { label: 'Aside', colorVar: '--studio-contain-aside' },
  raw: { label: 'Raw Material', colorVar: '--studio-contain-raw' },
};

export default function ContainBlockView(props: NodeViewProps) {
  const { node, updateAttributes, editor, getPos } = props;
  const containType = (node.attrs.containType as ContainType) || 'observation';
  const meta = CONTAIN_META[containType] ?? CONTAIN_META.observation;

  const [showTypePicker, setShowTypePicker] = useState(false);
  const [pickerPos, setPickerPos] = useState({ x: 0, y: 0 });
  const pickerRef = useRef<HTMLDivElement>(null);

  const handleDissolve = () => {
    const pos = getPos();
    if (typeof pos === 'number') {
      editor.chain().focus(pos + 1).unsetContainBlock().run();
    }
  };

  const handleHeaderContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPickerPos({ x: e.clientX, y: e.clientY });
      setShowTypePicker(true);
    },
    [],
  );

  const handleChangeType = useCallback(
    (newType: ContainType) => {
      updateAttributes({ containType: newType });
      setShowTypePicker(false);
    },
    [updateAttributes],
  );

  /* Close picker on click outside */
  useEffect(() => {
    if (!showTypePicker) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowTypePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTypePicker]);

  return (
    <NodeViewWrapper
      className="studio-contain-block"
      data-contain-type={containType}
    >
      <div
        className="studio-contain-header"
        contentEditable={false}
        onContextMenu={handleHeaderContextMenu}
      >
        <span className="studio-contain-badge">{meta.label}</span>
        <button
          type="button"
          className="studio-contain-dissolve"
          onClick={handleDissolve}
          title="Remove container, keep content"
        >
          dissolve
        </button>
      </div>

      {/* Type picker popup (right-click header) */}
      {showTypePicker && (
        <div
          ref={pickerRef}
          className="studio-context-menu"
          style={{
            position: 'fixed',
            left: pickerPos.x,
            top: pickerPos.y,
            zIndex: 9999,
          }}
        >
          {CONTAIN_TYPES.map((ct) => {
            const m = CONTAIN_META[ct];
            return (
              <button
                key={ct}
                type="button"
                className="studio-context-menu-item"
                onClick={() => handleChangeType(ct)}
                style={{
                  fontWeight: ct === containType ? 600 : 400,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: `var(${m.colorVar})`,
                    marginRight: '8px',
                    flexShrink: 0,
                  }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
      )}

      <NodeViewContent className="studio-contain-content" />
    </NodeViewWrapper>
  );
}
