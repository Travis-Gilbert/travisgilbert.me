'use client';

interface AtlasGraphControlsProps {
  onFit: () => void;
  onReset: () => void;
  onOpenCmdK: () => void;
  onToggleMeasure: () => void;
  measureOpen: boolean;
  onToggleLabels: () => void;
  labelsOn: boolean;
}

/**
 * Bottom-right parchment-glass control cluster on the Explorer canvas.
 * Fit, Reset, Labels, Measure, ⌘K.
 */
export default function AtlasGraphControls({
  onFit,
  onReset,
  onOpenCmdK,
  onToggleMeasure,
  measureOpen,
  onToggleLabels,
  labelsOn,
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
        onClick={onToggleLabels}
        aria-pressed={labelsOn}
        title={labelsOn ? 'Hide focal labels' : 'Show focal labels'}
      >
        Labels · {labelsOn ? 'on' : 'off'}
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
