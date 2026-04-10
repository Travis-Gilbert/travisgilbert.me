'use client';

import { useEffect, useRef } from 'react';
import { mulberry32 } from '@/lib/prng';

/**
 * ChatCanvas: subtle material texture for the chat home background.
 *
 * Three layers composited onto a single canvas:
 *   1. Base fill (#15161a)
 *   2. Very large, soft radial patches for gentle warm/cool drift
 *   3. Per-pixel luminance noise via ImageData (invisible at glance,
 *      felt as texture on sustained viewing)
 *   4. Warm bottom vignette (engine heat language)
 *
 * Uses mulberry32 PRNG for determinism. The noise is applied at 1x
 * resolution (not DPR-scaled) so it stays fine-grained on retina.
 */
export default function ChatCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Use the parent container's dimensions (not window) so the
    // texture fills correctly when offset by the sidebar.
    const parent = canvas.parentElement;
    const w = Math.min(parent?.clientWidth ?? window.innerWidth, 8192);
    const h = Math.min(parent?.clientHeight ?? window.innerHeight, 8192);
    if (w < 1 || h < 1) return;

    // Render at 1x (not DPR) so noise stays fine, not blocky on retina
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rng = mulberry32(0x4a8a96);

    // Layer 1: base fill (warm near-black)
    ctx.fillStyle = '#131210';
    ctx.fillRect(0, 0, w, h);

    // Layer 2: large soft patches (very gentle warm/cool tonal drift)
    // Much larger radii and lower alpha than before
    const patchCount = 12;
    for (let i = 0; i < patchCount; i++) {
      const x = rng() * w;
      const y = rng() * h;
      const radius = 300 + rng() * 600;

      const isWarm = rng() > 0.5;
      const r = isWarm ? 28 : 20;
      const g = isWarm ? 24 : 22;
      const b = isWarm ? 20 : 24;
      const alpha = 0.008 + rng() * 0.012; // much subtler: 0.8-2% opacity

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      gradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
      gradient.addColorStop(1, 'rgba(19, 18, 16, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }

    // Layer 3: per-pixel luminance noise via ImageData
    // This gives the surface a physical, almost paper-grain quality
    // without visible blocks or patterns
    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
      // +/- 1 value unit of luminance noise (very subtle, felt not seen)
      const noise = (rng() - 0.5) * 1.5;
      pixels[i] = Math.max(0, Math.min(255, pixels[i] + noise));       // R
      pixels[i + 1] = Math.max(0, Math.min(255, pixels[i + 1] + noise)); // G
      pixels[i + 2] = Math.max(0, Math.min(255, pixels[i + 2] + noise)); // B
      // Alpha unchanged
    }

    ctx.putImageData(imageData, 0, 0);

    // Layer 4: warm bottom vignette (engine heat language)
    const vignetteH = h * 0.3;
    const vignette = ctx.createLinearGradient(0, h, 0, h - vignetteH);
    vignette.addColorStop(0, 'rgba(196, 80, 60, 0.025)');
    vignette.addColorStop(0.5, 'rgba(196, 154, 74, 0.012)');
    vignette.addColorStop(1, 'rgba(19, 18, 16, 0)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
