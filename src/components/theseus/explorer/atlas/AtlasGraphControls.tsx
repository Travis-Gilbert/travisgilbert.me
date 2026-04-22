'use client';

interface AtlasGraphControlsProps {
  onFit: () => void;
  onReset: () => void;
  onOpenCmdK: () => void;
  onToggleMeasure: () => void;
  measureOpen: boolean;
}

/**
 * Bottom-right parchment-glass control cluster on the Explorer canvas.
 * Fit, Reset, Measure, ⌘K.
 */
export default function AtlasGraphControls({
  onFit,
  onReset,
  onOpenCmdK,
  onToggleMeasure,
  measureOpen,
}: AtlasGraphControlsProps) {
  return (
    <div className="atlas-graph-controls">
      <button type="button" className="atlas-gc-btn" onClick={onFit} title="Fit view">
        Fit
      </button>
      <button type="button" className="atlas-gc-btn" onClick={onReset} title="Reset view">
        Reset
      </button>
      <button
        type="button"
        className="atlas-gc-btn"
        onClick={onToggleMeasure}
        title={measureOpen ? 'Hide measurement charts' : 'Show measurement charts'}
      >
        Measure · {measureOpen ? 'on' : 'off'}
      </button>
      <button
        type="button"
        className="atlas-gc-btn"
        onClick={onOpenCmdK}
        title="Command palette"
      >
        <kbd>⌘K</kbd>
      </button>
    </div>
  );
}
