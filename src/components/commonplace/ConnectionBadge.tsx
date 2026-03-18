interface ConnectionBadgeProps {
  count: number;
  typeColor: string;
}

export default function ConnectionBadge({ count, typeColor }: ConnectionBadgeProps) {
  if (count < 3) return null;

  const hex = typeColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (
    <span
      style={{
        position: 'absolute',
        bottom: 6,
        right: 8,
        fontFamily: 'var(--font-code)',
        fontSize: 8,
        color: `rgba(${r}, ${g}, ${b}, 0.4)`,
        lineHeight: 1,
        pointerEvents: 'none',
      }}
    >
      {count} conn.
    </span>
  );
}
