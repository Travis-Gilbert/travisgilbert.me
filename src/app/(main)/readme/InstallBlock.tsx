'use client';

const LINES = [
  { type: 'comment', text: '# contact' },
  {
    type: 'code',
    parts: [
      { text: 'email', style: 'keyword' },
      { text: '    travisgilbert.me@gmail.com', style: 'string' },
    ],
  },
  {
    type: 'code',
    parts: [
      { text: 'youtube', style: 'keyword' },
      { text: '  @curioustangents', style: 'string' },
    ],
  },
  {
    type: 'code',
    parts: [
      { text: 'github', style: 'keyword' },
      { text: '   @travisgilbert', style: 'string' },
    ],
  },
  { type: 'blank', text: '' },
  { type: 'comment', text: '# prefer email. I read everything.' },
] as const;

const STYLE_MAP = {
  keyword: '#7EC8E3',
  string: 'var(--color-gold)',
} as const;

export default function InstallBlock() {
  return (
    <div
      style={{
        background: '#111114',
        border: '1px solid var(--color-readme-border)',
        borderRadius: '8px',
        padding: '18px 22px',
        marginTop: '14px',
        overflowX: 'auto',
      }}
    >
      <code
        style={{
          fontFamily: 'var(--font-code)',
          fontSize: '13px',
          color: 'var(--color-readme-text)',
          lineHeight: 1.8,
          display: 'block',
        }}
      >
        {LINES.map((line, i) => (
          <div key={i}>
            {line.type === 'comment' && (
              <span style={{ color: 'var(--color-readme-text-dim)' }}>
                {line.text}
              </span>
            )}
            {line.type === 'code' &&
              line.parts.map((part, j) => (
                <span key={j} style={{ color: STYLE_MAP[part.style] }}>
                  {part.text}
                </span>
              ))}
            {line.type === 'blank' && <br />}
          </div>
        ))}
      </code>
    </div>
  );
}
