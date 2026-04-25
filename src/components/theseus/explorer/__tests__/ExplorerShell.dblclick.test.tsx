/**
 * Verifies the gesture contract from ADR 0004:
 *   per-node double-click  -> opens Reflex tab, lens unchanged
 *   empty-canvas dblclick  -> toggles lens (covered by existing behavior)
 *
 * The full ExplorerShell tree is heavy (cosmos.gl, mosaic, hooks); this
 * test focuses on the wiring contract by exercising the ref-flag guard
 * directly against a minimal harness that mirrors the same logic.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';

import { openNodeDetail } from '@/lib/theseus/nodeDetailUrl';

vi.mock('@/lib/theseus/nodeDetailUrl', () => ({
  openNodeDetail: vi.fn(),
  nodeDetailUrl: (pk: string | number) => `https://node.travisgilbert.me/n/${pk}`,
}));

function Harness({
  onPointDoubleClick,
}: {
  onPointDoubleClick: (pointId: string) => void;
}) {
  const nodeDoubleClickedRef = useRef(false);
  const [lens, setLens] = useState<'flow' | 'atlas'>('flow');

  useEffect(() => {
    const container = document.querySelector('.atlas-canvas');
    if (!container) return;
    function onDblClick(event: Event) {
      if (nodeDoubleClickedRef.current) return;
      if (lens === 'atlas') return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.tagName !== 'CANVAS') return;
      setLens('atlas');
    }
    container.addEventListener('dblclick', onDblClick);
    return () => container.removeEventListener('dblclick', onDblClick);
  }, [lens]);

  return (
    <div className="atlas-canvas">
      <canvas
        data-testid="canvas"
        onDoubleClick={() => {
          nodeDoubleClickedRef.current = true;
          window.setTimeout(() => {
            nodeDoubleClickedRef.current = false;
          }, 50);
          onPointDoubleClick('42');
        }}
      />
      <span data-testid="lens">{lens}</span>
    </div>
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('ExplorerShell double-click contract', () => {
  it('per-node double-click opens Reflex and leaves the lens alone', () => {
    const handler = vi.fn((pointId: string) => openNodeDetail(pointId));
    const { getByTestId } = render(<Harness onPointDoubleClick={handler} />);
    fireEvent.doubleClick(getByTestId('canvas'));
    expect(handler).toHaveBeenCalledWith('42');
    expect(openNodeDetail).toHaveBeenCalledWith('42');
    expect(getByTestId('lens').textContent).toBe('flow');
  });

  it('empty-canvas double-click on a non-canvas target does NOT open Reflex and does NOT toggle lens', () => {
    const handler = vi.fn((pointId: string) => openNodeDetail(pointId));
    const { container, getByTestId } = render(<Harness onPointDoubleClick={handler} />);
    const wrapper = container.querySelector('.atlas-canvas') as HTMLElement;
    fireEvent.doubleClick(wrapper);
    expect(openNodeDetail).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
    expect(getByTestId('lens').textContent).toBe('flow');
  });
});
