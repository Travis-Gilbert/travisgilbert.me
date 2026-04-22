'use client';

interface SurfaceCheckProps {
  on: boolean;
  onChange: () => void;
  dotColor: string;
  label: string;
  description: string;
}

/** Inline checkbox row for Atlas Explorer surface overlays (Theseus /
 *  Theorem Web / Code Graph). */
export default function SurfaceCheck({
  on,
  onChange,
  dotColor,
  label,
  description,
}: SurfaceCheckProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`atlas-surface-check${on ? ' is-on' : ''}`}
      title={description}
      aria-pressed={on}
    >
      <span aria-hidden className="box">
        {on ? '✓' : ''}
      </span>
      <span aria-hidden className="swatch" style={{ background: dotColor }} />
      <span>{label}</span>
      <span className="meta">{on ? 'on' : ''}</span>
    </button>
  );
}
