'use client';

import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
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
  const { node, editor, getPos } = props;
  const containType = (node.attrs.containType as ContainType) || 'observation';
  const meta = CONTAIN_META[containType] ?? CONTAIN_META.observation;

  const handleDissolve = () => {
    const pos = getPos();
    if (typeof pos === 'number') {
      editor.chain().focus(pos + 1).unsetContainBlock().run();
    }
  };

  return (
    <NodeViewWrapper
      className="studio-contain-block"
      data-contain-type={containType}
    >
      <div className="studio-contain-header" contentEditable={false}>
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
      <NodeViewContent className="studio-contain-content" />
    </NodeViewWrapper>
  );
}
