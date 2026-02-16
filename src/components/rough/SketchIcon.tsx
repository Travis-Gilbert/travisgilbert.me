/**
 * SketchIcon: Hand-drawn SVG icons matching the rough.js aesthetic.
 * Pure SVG with slightly imperfect strokes for that "drawn on paper" feel.
 * Server Component (no browser APIs needed).
 *
 * Icons use a consistent 32x32 viewBox with hand-drawn paths.
 * Strokes use the brand rough color and `stroke-linecap: round`
 * for a felt-tip pen effect.
 */

interface SketchIconProps {
  name: IconName;
  size?: number;
  color?: string;
  className?: string;
}

type IconName =
  | 'magnifying-glass'
  | 'file-text'
  | 'note-pencil'
  | 'briefcase'
  | 'wrench'
  | 'book-open'
  | 'chat-circle'
  | 'tag'
  | 'info';

const ICON_PATHS: Record<IconName, string> = {
  // Magnifying glass: slightly wobbly circle + angled handle
  'magnifying-glass':
    'M14.2 6.5c4.2 0.3 7.3 3.6 7.1 7.8s-3.5 7.4-7.7 7.1c-4.2-0.3-7.4-3.7-7.1-7.9 0.3-4.1 3.5-7.3 7.7-7zm6.3 14.8l5.8 5.3',
  // File with text lines: document page with slightly uneven lines
  'file-text':
    'M7.5 4.5h11.5l5.5 5.5v16.5c0 0.8-0.7 1.5-1.5 1.5H7.5c-0.8 0-1.5-0.7-1.5-1.5V6c0-0.8 0.7-1.5 1.5-1.5zM19 4.5v5.5h5.5M10.5 15h11m-11 4h8.5m-8.5 4h10',
  // Pencil on paper: folded corner + pencil line
  'note-pencil':
    'M6 4.5h15.5c1 0 1.8 0.8 1.8 1.8v19.2c0 1-0.8 1.8-1.8 1.8H8.5c-1 0-1.8-0.8-1.8-1.8V6.2c-0.1-0.9 0.7-1.7 1.7-1.7zm3 9.5h10m-10 4.5h7m7-14l-4.5 4.5',
  // Briefcase: boxy with handle
  'briefcase':
    'M5.5 11.5h21.5c0.8 0 1.5 0.7 1.5 1.5v11c0 0.8-0.7 1.5-1.5 1.5H5c-0.8 0-1.5-0.7-1.5-1.5V13c0-0.8 0.7-1.5 1.5-1.5zm7-4.5v4.5m7-4.5v4.5m-9.5-4.5h12c0.6 0 1-0.4 1-1V5.5c0-0.6-0.4-1-1-1h-12c-0.6 0-1 0.4-1 1V6.5c0 0.6 0.4 1 1 1z',
  // Wrench: angled with open jaw
  'wrench':
    'M8.5 24l12-12.5c-1.5-3.5-0.5-7.5 2.5-9.5 2-1.3 4.5-1.5 6.5-0.5l-4 4.2 0.5 3.8 3.5 0.5 4.2-4c1 2 0.8 4.5-0.5 6.5-2 3-6 4-9.5 2.5L12 27.5c-0.8 0.8-2.2 0.8-3 0l-0.5-0.5c-0.8-0.8-0.8-2.2 0-3z',
  // Open book: two page spreads
  'book-open':
    'M16 7c-2-2-5.5-2.5-10-2.5v19c4.5 0 8 0.5 10 2.5 2-2 5.5-2.5 10-2.5v-19c-4.5 0-8 0.5-10 2.5zm0 0v18.5',
  // Chat bubble: rounded with tail
  'chat-circle':
    'M16 4.5c6.5-0.2 12 5 12.2 11.5 0.1 3.5-1.4 6.7-4 9l1 5.5-5.5-2.5c-1.2 0.3-2.4 0.5-3.7 0.5-6.5 0.2-12-5-12.2-11.5S9.5 4.7 16 4.5z',
  // Tag: classic tag shape with hole
  'tag':
    'M4.5 17.2L15 6.5c0.4-0.4 0.9-0.6 1.4-0.6h9.6c0.8 0 1.5 0.7 1.5 1.5v9.6c0 0.5-0.2 1-0.6 1.4L16.2 29c-0.8 0.8-2 0.8-2.8 0L4.5 20c-0.8-0.8-0.8-2 0-2.8zM23 12.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
  // Info: circle with i
  'info':
    'M16 4c6.6 0.1 11.9 5.5 11.8 12.1-0.1 6.5-5.4 11.8-12 11.9-6.6-0.1-11.9-5.5-11.8-12.1C4.1 9.4 9.4 4.1 16 4zm0 8.5v9m0-12.5v0.5',
};

export default function SketchIcon({
  name,
  size = 32,
  color = 'currentColor',
  className = '',
}: SketchIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d={ICON_PATHS[name]}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type { IconName, SketchIconProps };
