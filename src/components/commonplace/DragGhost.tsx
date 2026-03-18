interface DragGhostProps {
  x: number;
  y: number;
  width: number;
  height: number;
  typeColor: string;
}

export default function DragGhost({
  x,
  y,
  width,
  height,
  typeColor,
}: DragGhostProps) {
  const hex = typeColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: `1px dashed rgba(${r}, ${g}, ${b}, 0.15)`,
        borderRadius: 6,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
