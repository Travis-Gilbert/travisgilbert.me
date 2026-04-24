'use client';

interface AtlasPlateLabelProps {
  plate?: string;
  figure?: string;
  title: string;
  nodes: number;
  edges: number;
  /** Pre-filter total edge count from the backend. If set and larger
   *  than `edges`, the plate renders "DISPLAYED OF TOTAL EDGES" to be
   *  honest about the top-K filter in effect. */
  edgesTotal?: number;
  surfaceLabel: string;
  onDismissDirective?: () => void;
  directiveActive?: boolean;
}

/**
 * Top-left parchment-glass plate label on the Explorer canvas.
 *
 * Shows the current scene identity (plate + figure), the scene title,
 * and meta (node/edge counts + active surface label). When a scene
 * directive from chat is active, the `onDismissDirective` handler is
 * surfaced as a small dismiss chip.
 */
export default function AtlasPlateLabel({
  plate = 'Plate 03',
  figure = 'Fig. 7',
  title,
  nodes,
  edges,
  edgesTotal,
  surfaceLabel,
  onDismissDirective,
  directiveActive = false,
}: AtlasPlateLabelProps) {
  return (
    <div
      className="parchment-glass"
      style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        font: '500 10px/1.3 var(--font-mono)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: 'var(--paper-ink-3)',
        padding: '10px 14px',
        borderRadius: 3,
        maxWidth: 360,
      }}
    >
      <div>
        {plate} · {figure}
      </div>
      <div
        style={{
          color: 'var(--paper-ink)',
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: '-0.005em',
          textTransform: 'none',
        }}
      >
        {title}
      </div>
      <div>
        {nodes} nodes ·{' '}
        {edgesTotal !== undefined && edgesTotal !== edges ? (
          <>
            {edges} of {edgesTotal} edges
          </>
        ) : (
          <>{edges} edges</>
        )}
        {surfaceLabel && (
          <span style={{ marginLeft: 8, color: 'var(--paper-pencil)' }}>
            · {surfaceLabel}
          </span>
        )}
      </div>
      {directiveActive && onDismissDirective && (
        <button
          type="button"
          onClick={onDismissDirective}
          style={{
            alignSelf: 'flex-start',
            marginTop: 4,
            background: 'transparent',
            border: '1px solid var(--paper-rule)',
            borderRadius: 2,
            padding: '3px 8px',
            font: '500 9px/1 var(--font-mono)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--paper-pencil)',
            cursor: 'pointer',
          }}
        >
          Dismiss directive
        </button>
      )}
    </div>
  );
}
