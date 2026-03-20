import { BELIEF_ROWS } from './theseus-data';

export default function BeliefTable() {
  return (
    <div
      style={{
        background: 'var(--color-theseus-panel)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: 'inset 0 0 16px rgba(180, 90, 45, 0.06), 0 4px 20px rgba(0, 0, 0, 0.08)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 13,
            lineHeight: 1.55,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              {['Domain', 'Canonical Model', 'Local Evidence', 'Engine Result'].map(
                (h) => (
                  <th
                    key={h}
                    style={{
                      fontFamily: 'var(--font-code)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--color-ink-light)',
                      textAlign: 'left',
                      padding: '14px 16px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {BELIEF_ROWS.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom:
                    i < BELIEF_ROWS.length - 1
                      ? '1px solid var(--color-border-light)'
                      : undefined,
                }}
              >
                <td
                  style={{
                    padding: '12px 16px',
                    fontFamily: 'var(--font-code)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: row.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.domain}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    color: 'var(--color-ink-muted)',
                  }}
                >
                  {row.canonical}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    color: 'var(--color-ink)',
                  }}
                >
                  {row.local}
                </td>
                <td
                  style={{
                    padding: '12px 16px',
                    fontWeight: 600,
                    color: 'var(--color-terracotta)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.result}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
