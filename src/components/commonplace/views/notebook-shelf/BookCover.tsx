'use client';

/**
 * BookCover: shared cover renderer for both FeaturedBook and ShelfBook.
 * Renders a gradient cover with title, separator line, and object count.
 */

interface BookCoverProps {
  title: string;
  objectCount: number;
  color: string;
  size: 'featured' | 'shelf';
  isLoose?: boolean;
  className?: string;
}

function darkenColor(hex: string, percent: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  const factor = 1 - percent / 100;
  const dr = Math.round(r * factor);
  const dg = Math.round(g * factor);
  const db = Math.round(b * factor);
  return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
}

export default function BookCover({
  title,
  objectCount,
  color,
  size,
  isLoose = false,
  className = '',
}: BookCoverProps) {
  const coverClass = size === 'featured'
    ? 'cp-bookshelf-cover'
    : 'cp-bookshelf-flat-cover';

  const looseClass = isLoose ? ' cp-bookshelf-cover-loose' : '';

  const gradientStyle = isLoose
    ? undefined
    : { background: `linear-gradient(160deg, ${color} 0%, ${darkenColor(color, 20)} 100%)` };

  const countLabel = size === 'featured'
    ? `${objectCount} objects`
    : `${objectCount}`;

  return (
    <div
      className={`${coverClass}${looseClass} ${className}`}
      style={gradientStyle}
    >
      <div>
        <div className="cp-bookshelf-cover-title">{title}</div>
      </div>
      <div className="cp-bookshelf-cover-footer">
        {!isLoose && <div className="cp-bookshelf-cover-line" />}
        <div className="cp-bookshelf-cover-count">
          {isLoose ? '?' : countLabel}
        </div>
      </div>
    </div>
  );
}
