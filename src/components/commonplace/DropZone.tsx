'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { CapturedObject } from '@/lib/commonplace';
import { getObjectTypeIdentity } from '@/lib/commonplace';
import {
  createCapturedObject,
  inferTypeFromDrop,
  inferTypeFromFile,
  readFileAsText,
} from '@/lib/commonplace-capture';

/**
 * DropZone: full-screen drag-and-drop overlay.
 *
 * When the user drags content over the CommonPlace layout, this
 * overlay appears with a dashed border and "digitize" prompt.
 * On drop, the content is captured with a framer-motion particle
 * scatter animation: 14-18 circles burst outward then converge
 * to the sidebar. Colors sample from the dropped image when
 * available, otherwise fall back to brand palette.
 *
 * Renders as a portal-style overlay on the layout root.
 */

interface DropZoneProps {
  onCapture: (object: CapturedObject) => void;
}

/* ─────────────────────────────────────────────────
   Mulberry32 PRNG (deterministic seeded random)
   Same pattern as HeroAccents.tsx (djb2 + LCG)
   ───────────────────────────────────────────────── */

function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/* ─────────────────────────────────────────────────
   Particle scatter constants
   ───────────────────────────────────────────────── */

const PALETTE = ['#B45A2D', '#2D5F6B', '#C49A4A', '#8C7B6E', '#5A7A4A'];
const PARTICLE_SPRING = [0.34, 1.56, 0.64, 1] as const;

interface Particle {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  r: number;
  color: string;
  delay: number;
}

/* Sample up to 4 dominant colors from a dropped image file using canvas. */
async function sampleImageColors(file: File): Promise<string[]> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve([]); return; }
        ctx.drawImage(img, 0, 0, 32, 32);
        const data = ctx.getImageData(0, 0, 32, 32).data;
        /* Sample pixels at 4 corners and center */
        const positions = [0, 7, 15, 23, 31].flatMap((x) =>
          [0, 7, 15, 23, 31].map((y) => (y * 32 + x) * 4)
        );
        const colors: string[] = [];
        for (const p of positions.slice(0, 4)) {
          const r = data[p]; const g = data[p + 1]; const b = data[p + 2];
          if (r !== undefined && g !== undefined && b !== undefined) {
            colors.push(`rgb(${r},${g},${b})`);
          }
        }
        resolve(colors);
      } catch {
        resolve([]);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve([]); };
    img.src = url;
  });
}

function buildParticles(seed: string, colors: string[]): Particle[] {
  const rng = mulberry32(djb2(seed));
  const palette = colors.length >= 4 ? colors : PALETTE;
  const count = Math.floor(rng() * 5) + 14; /* 14-18 */
  return Array.from({ length: count }, (_, i) => {
    const angle = rng() * Math.PI * 2;
    const dist = 60 + rng() * 140;
    return {
      id: i,
      x: 0,
      y: 0,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      r: 4 + rng() * 10,
      color: palette[Math.floor(rng() * palette.length)] ?? PALETTE[0],
      delay: i * 0.025,
    };
  });
}

/* ─────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────── */

export default function DropZone({ onCapture }: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isAbsorbing, setIsAbsorbing] = useState(false);
  const [absorbLabel, setAbsorbLabel] = useState('');
  const [absorbSeed, setAbsorbSeed] = useState('drop');
  const [absorbColors, setAbsorbColors] = useState<string[]>([]);
  const [dragCounter, setDragCounter] = useState(0);

  /* Track drag enter/leave with a counter because child elements
     fire their own dragenter/dragleave events. This is the standard
     workaround for the "flickering overlay" problem. */

  const handleDragEnter = useCallback((e: DragEvent) => {
    // Ignore internal tab drags (they use a custom MIME type)
    if (e.dataTransfer?.types.includes('application/commonplace-tab')) return;
    e.preventDefault();
    setDragCounter((c) => {
      if (c === 0) setIsDragActive(true);
      return c + 1;
    });
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.types.includes('application/commonplace-tab')) return;
    e.preventDefault();
    setDragCounter((c) => {
      const next = c - 1;
      if (next <= 0) {
        setIsDragActive(false);
        return 0;
      }
      return next;
    });
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (e.dataTransfer?.types.includes('application/commonplace-tab')) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      // Ignore internal tab drags
      if (e.dataTransfer?.types.includes('application/commonplace-tab')) return;
      e.preventDefault();
      setIsDragActive(false);
      setDragCounter(0);

      if (!e.dataTransfer) return;

      /* Extract drop info synchronously (DataTransfer only lives during the event). */
      const dropInfo = inferTypeFromDrop(e.dataTransfer);

      const processCapture = async () => {
        let object: CapturedObject;
        let imageSeed = 'drop';
        let imageColors: string[] = [];

        if (dropInfo.type === 'file' && dropInfo.file) {
          const fileType = inferTypeFromFile(dropInfo.file);
          const textContent = await readFileAsText(dropInfo.file);

          /* Sample colors from image files for particle palette */
          if (dropInfo.file.type.startsWith('image/')) {
            imageColors = await sampleImageColors(dropInfo.file);
          }

          object = createCapturedObject({
            text: textContent ?? dropInfo.file.name,
            objectType: fileType,
            captureMethod: 'dropped',
            file: textContent ? undefined : dropInfo.file,
          });
          object.title = dropInfo.file.name;
          imageSeed = dropInfo.file.name;
        } else {
          object = createCapturedObject({
            text: dropInfo.content,
            captureMethod: 'dropped',
            sourceUrl: dropInfo.type === 'url' ? dropInfo.content : undefined,
          });
          imageSeed = dropInfo.content.slice(0, 20);
        }

        const typeInfo = getObjectTypeIdentity(object.objectType);
        setAbsorbLabel(typeInfo.label);
        setAbsorbSeed(imageSeed);
        setAbsorbColors(imageColors);
        setIsAbsorbing(true);

        setTimeout(() => {
          onCapture(object);
          setIsAbsorbing(false);
          setAbsorbLabel('');
          setAbsorbColors([]);
        }, 920);
      };

      processCapture();
    },
    [onCapture]
  );

  /* Attach drag listeners to document */
  useEffect(() => {
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  /* Build particle list deterministically from the seed */
  const particles = useMemo(
    () => (isAbsorbing ? buildParticles(absorbSeed, absorbColors) : []),
    [isAbsorbing, absorbSeed, absorbColors]
  );
  const convergeTarget = useMemo(() => {
    if (typeof window === 'undefined') return { x: -420, y: -260 };
    const sidebarCaptureX = Math.min(164, window.innerWidth * 0.14);
    const sidebarCaptureY = Math.min(104, window.innerHeight * 0.16);
    return {
      x: sidebarCaptureX - window.innerWidth / 2,
      y: sidebarCaptureY - window.innerHeight / 2,
    };
  }, [isAbsorbing]);

  /* ── Portal target: render overlays at document.body to escape stacking contexts ── */

  /* Absorb animation overlay */
  if (isAbsorbing) {
    return createPortal(
      <div className="cp-dropzone-overlay" data-active="true" aria-hidden="true">
        {/* Center label */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 12,
            letterSpacing: '0.1em',
            color: 'var(--cp-text)',
            textTransform: 'uppercase',
            zIndex: 2,
          }}
        >
          {absorbLabel} captured
        </motion.div>

        {/* Particle burst */}
        <AnimatePresence>
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: 0, y: 0, scale: 1.2, opacity: 1 }}
              animate={{
                x: [0, p.dx, convergeTarget.x],
                y: [0, p.dy, convergeTarget.y],
                scale: [1.2, 0.8, 0.3],
                opacity: [1, 1, 0],
              }}
              exit={{ x: convergeTarget.x, y: convergeTarget.y, scale: 0.25, opacity: 0 }}
              transition={{
                duration: 0.82,
                delay: p.id * 0.01,
                ease: PARTICLE_SPRING,
                times: [0, 0.45, 1],
              }}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: p.r * 2,
                height: p.r * 2,
                marginTop: -p.r,
                marginLeft: -p.r,
                borderRadius: '50%',
                backgroundColor: p.color,
                pointerEvents: 'none',
              }}
            />
          ))}
        </AnimatePresence>
      </div>,
      document.body
    );
  }

  /* Drag active overlay */
  if (!isDragActive) return null;

  return createPortal(
    <div className="cp-dropzone-overlay" data-active="true">
      <div className="cp-dropzone-inner">
        <svg
          width={32}
          height={32}
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--cp-red)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.7 }}
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
        <div
          style={{
            fontFamily: 'var(--cp-font-mono)',
            fontSize: 13,
            letterSpacing: '0.08em',
            color: 'var(--cp-text-muted)',
            marginTop: 12,
          }}
        >
          DROP TO CAPTURE
        </div>
        <div
          style={{
            fontFamily: 'var(--cp-font-body)',
            fontSize: 12,
            color: 'var(--cp-text-faint)',
            marginTop: 4,
          }}
        >
          URLs, text, or files
        </div>
      </div>
    </div>,
    document.body
  );
}
