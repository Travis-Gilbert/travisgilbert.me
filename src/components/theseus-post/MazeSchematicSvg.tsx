// MazeSchematicSvg.tsx: SVG overlay rendering labels, cross-hatching, flow arrows,
// dimension lines, graph nodes, registration marks, and the title block.
// Uses viewBox to auto-scale to the 1400x2000 coordinate space.

import {
  MAZE_W, MAZE_H,
  MAZE_LABELS, CROSS_HATCH_REGIONS, FLOW_ARROWS, FEEDBACK_ARROW_PATH,
  DIMENSION_LINES, GRAPH_NODES, REGISTRATION_MARKS, TITLE_BLOCK,
  INK, INK_LIGHT, INK_FAINT, INK_GHOST, INK_WHISPER,
  TEAL, AMBER,
} from './MazeWalls';

function CrossHatch({
  x, y, w: width, h: height, spacing, color, opacity,
}: {
  x: number; y: number; w: number; h: number;
  spacing: number; color: string; opacity: number;
}) {
  const id = `hatch-${x}-${y}`;
  const diag = Math.sqrt(width * width + height * height);
  const count = Math.ceil(diag / spacing);
  const lines: React.ReactElement[] = [];

  for (let i = -count; i <= count; i++) {
    const offset = i * spacing;
    lines.push(
      <line
        key={i}
        x1={x + offset}
        y1={y + height}
        x2={x + offset + height}
        y2={y}
        stroke={color}
        strokeWidth={0.4}
        opacity={opacity}
      />,
    );
  }

  return (
    <g>
      <clipPath id={id}>
        <rect x={x} y={y} width={width} height={height} />
      </clipPath>
      <g clipPath={`url(#${id})`}>{lines}</g>
    </g>
  );
}

export default function MazeSchematicSvg() {
  return (
    <svg
      viewBox={`0 0 ${MAZE_W} ${MAZE_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMin slice"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <defs>
        {/* Flow arrow marker */}
        <marker
          id="flowArr"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L6,2.5 L0,5 L1.5,2.5 Z" fill={INK_LIGHT} />
        </marker>
        {/* Feedback arrow marker (amber) */}
        <marker
          id="fbArr"
          markerWidth="6"
          markerHeight="5"
          refX="5"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L6,2.5 L0,5 L1.5,2.5 Z" fill={AMBER} />
        </marker>
      </defs>

      {/* Cross-hatching fills */}
      {CROSS_HATCH_REGIONS.map((r, i) => (
        <CrossHatch key={`ch-${i}`} {...r} />
      ))}

      {/* Graph nodes inside KG vault */}
      {GRAPH_NODES.map((n, i) => (
        <g key={`gn-${i}`}>
          <circle
            cx={n.cx}
            cy={n.cy}
            r={n.r}
            fill="none"
            stroke={TEAL}
            strokeWidth={0.7}
            opacity={0.5}
          />
          {i > 0 && i % 3 !== 0 && (
            <line
              x1={n.cx}
              y1={n.cy}
              x2={n.cx - 20 + ((i * 31) % 40)}
              y2={n.cy - 15 + ((i * 23) % 30)}
              stroke={TEAL}
              strokeWidth={0.3}
              opacity={0.25}
            />
          )}
        </g>
      ))}

      {/* Data flow arrows (dashed) */}
      {FLOW_ARROWS.map((d, i) => (
        <path
          key={`fl-${i}`}
          d={d}
          fill="none"
          stroke={INK_FAINT}
          strokeWidth={0.8}
          strokeDasharray="3,4"
          markerEnd="url(#flowArr)"
          opacity={0.5}
        />
      ))}

      {/* Feedback return path (amber) */}
      <path
        d={FEEDBACK_ARROW_PATH}
        fill="none"
        stroke={AMBER}
        strokeWidth={1.2}
        strokeDasharray="6,4"
        markerEnd="url(#fbArr)"
        opacity={0.45}
      />

      {/* Dimension lines */}
      {DIMENSION_LINES.map((dl, i) => (
        <g key={`dim-${i}`}>
          <line
            x1={dl.x1} y1={dl.y1} x2={dl.x2} y2={dl.y2}
            stroke={INK_WHISPER} strokeWidth={0.4}
          />
          {dl.tickX1 !== undefined && (
            <line
              x1={dl.tickX1} y1={dl.tickY1!} x2={dl.tickX2!} y2={dl.tickY2!}
              stroke={INK_WHISPER} strokeWidth={0.4}
            />
          )}
          {dl.tickEndX1 !== undefined && (
            <line
              x1={dl.tickEndX1} y1={dl.tickEndY1!} x2={dl.tickEndX2!} y2={dl.tickEndY2!}
              stroke={INK_WHISPER} strokeWidth={0.4}
            />
          )}
        </g>
      ))}

      {/* Labels */}
      {MAZE_LABELS.map((l, i) => (
        <text
          key={`lb-${i}`}
          x={l.x}
          y={l.y}
          textAnchor="middle"
          fontSize={l.size}
          fontWeight={l.weight ?? (l.family === 'mono' ? 600 : 400)}
          fontStyle={l.style ?? 'normal'}
          fontFamily={
            l.family === 'mono'
              ? "var(--font-mono, 'Courier New', monospace)"
              : "var(--font-title, 'Georgia', serif)"
          }
          fill={l.color ?? INK}
          letterSpacing={l.tracking ?? 0.5}
          opacity={l.color === INK_FAINT || l.color === INK_LIGHT ? 0.8 : 1}
          transform={
            l.rotate
              ? `rotate(${l.rotate},${l.x},${l.y})`
              : undefined
          }
        >
          {l.text}
        </text>
      ))}

      {/* Registration marks */}
      {REGISTRATION_MARKS.map(([cx, cy], i) => (
        <g key={`reg-${i}`}>
          <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke={INK_GHOST} strokeWidth={0.4} />
          <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke={INK_GHOST} strokeWidth={0.4} />
          <circle cx={cx} cy={cy} r={3} fill="none" stroke={INK_GHOST} strokeWidth={0.3} />
        </g>
      ))}

      {/* Border frame (double-rule patent style) */}
      <rect x={42} y={42} width={MAZE_W - 84} height={MAZE_H - 84}
        fill="none" stroke={INK_GHOST} strokeWidth={0.5} />
      <rect x={48} y={48} width={MAZE_W - 96} height={MAZE_H - 96}
        fill="none" stroke={INK_LIGHT} strokeWidth={1.5} />

      {/* Title block separator */}
      <line x1={48} y1={1900} x2={MAZE_W - 48} y2={1900}
        stroke={INK_LIGHT} strokeWidth={0.8} />

      {/* Title block */}
      <text x={700} y={1935} textAnchor="middle" fontSize={8}
        fontFamily="var(--font-mono, 'Courier New', monospace)"
        fill={INK_LIGHT} letterSpacing={2.5}>
        {TITLE_BLOCK.line1}
      </text>
      <text x={700} y={1955} textAnchor="middle" fontSize={6.5}
        fontFamily="var(--font-mono, 'Courier New', monospace)"
        fill={INK_GHOST} letterSpacing={1.5}>
        {TITLE_BLOCK.line2}
      </text>
      <text x={700} y={1975} textAnchor="middle" fontSize={5.5}
        fontFamily="var(--font-mono, 'Courier New', monospace)"
        fill={INK_WHISPER} letterSpacing={1}>
        {TITLE_BLOCK.line3}
      </text>

      {/* Shannon quote */}
      <g transform="translate(700, 1820)">
        <text textAnchor="middle" fontSize={8}
          fontFamily="var(--font-title, 'Georgia', serif)"
          fontStyle="italic" fill={INK_LIGHT} letterSpacing={0.3}>
          &ldquo;{TITLE_BLOCK.quote1}
        </text>
        <text y={14} textAnchor="middle" fontSize={8}
          fontFamily="var(--font-title, 'Georgia', serif)"
          fontStyle="italic" fill={INK_LIGHT} letterSpacing={0.3}>
          {TITLE_BLOCK.quote2}&rdquo;
        </text>
        <text y={30} textAnchor="middle" fontSize={5.5}
          fontFamily="var(--font-mono, 'Courier New', monospace)"
          fill={INK_GHOST} letterSpacing={2}>
          {TITLE_BLOCK.quoteAttr}
        </text>
      </g>
    </svg>
  );
}
