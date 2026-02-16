import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';
export const alt = 'Travis Gilbert: Investigations, Projects, and Field Notes';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#F0EBE4',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'Georgia, serif',
          position: 'relative',
        }}
      >
        {/* Subtle border frame */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: '2px solid #D4CCC4',
            borderRadius: 8,
            display: 'flex',
          }}
        />

        {/* Top accent line */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: 80,
            right: 80,
            height: 3,
            background: '#B45A2D',
            display: 'flex',
          }}
        />

        {/* Name */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 400,
            color: '#2A2420',
            lineHeight: 1,
            marginBottom: 24,
            display: 'flex',
          }}
        >
          Travis Gilbert
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#6A5E52',
            lineHeight: 1.5,
            maxWidth: 700,
            display: 'flex',
          }}
        >
          Investigating how design decisions shape human outcomes.
        </div>

        {/* Bottom section markers */}
        <div
          style={{
            display: 'flex',
            gap: 40,
            marginTop: 48,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#B45A2D',
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontFamily: 'Courier New, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6A5E52',
                display: 'flex',
              }}
            >
              Investigations
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#C49A4A',
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontFamily: 'Courier New, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6A5E52',
                display: 'flex',
              }}
            >
              Projects
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#2D5F6B',
                display: 'flex',
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontFamily: 'Courier New, monospace',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#6A5E52',
                display: 'flex',
              }}
            >
              Field Notes
            </span>
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            right: 80,
            fontSize: 16,
            fontFamily: 'Courier New, monospace',
            color: '#9A8E82',
            display: 'flex',
          }}
        >
          travisgilbert.com
        </div>
      </div>
    ),
    { ...size }
  );
}
