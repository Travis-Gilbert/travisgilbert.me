/**
 * GeographicRenderer: Map image with neighborhood region overlays.
 *
 * "Best neighborhoods in Chicago" renders as the Chicago street grid
 * traced via Sobel edge detection, with colored region overlays for
 * scored neighborhoods.
 *
 * This renderer is ONLY used for geographic answer types. Portrait and
 * diagram types go directly through VisionTracer/ImageTracer without
 * a custom renderer.
 *
 * The renderer does two things the raw ImageTracer cannot:
 *   1. Contrast adjustment on map images (darken streets, lighten bg)
 *   2. Neighborhood region overlays drawn on both visual and ID canvases
 *
 * The output feeds into StipplingEngine the same way other renderers do:
 * dual canvases (visual for brightness, idMap for semantics).
 */

import type { GeographicRegion, GeographicRegionsSection } from '@/lib/theseus-types';
import type { OffscreenRenderResult, IdEntry } from './types';
import { createCanvasPair, indexToHex, OFFSCREEN_SIZE, centerOutwardPhaseTemplate } from './types';

/**
 * Draw a map image onto the visual canvas with contrast enhancement
 * optimized for stippling (dark streets become high-contrast white edges).
 */
function drawMapImage(
  visualCtx: OffscreenCanvasRenderingContext2D,
  img: HTMLImageElement,
): void {
  const S = OFFSCREEN_SIZE;

  // Draw the image scaled to fill the canvas
  visualCtx.drawImage(img, 0, 0, S, S);

  // Apply adaptive contrast: remap to maximize edge visibility.
  // Streets (dark) become white, background (light) becomes black.
  // This is the inverse of normal viewing because stippling places
  // dots in DARK regions of the visual canvas.
  const imageData = visualCtx.getImageData(0, 0, S, S);
  const data = imageData.data;
  const pixelCount = S * S;

  // Compute luminance once and cache for both histogram and remap passes
  const lums = new Float32Array(pixelCount);
  const histogram = new Uint32Array(256);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    lums[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    histogram[Math.round(lums[p])]++;
  }

  // Find 30th percentile as threshold (streets are typically darker)
  let cumulative = 0;
  let threshold = 128;
  for (let i = 0; i < 256; i++) {
    cumulative += histogram[i];
    if (cumulative >= pixelCount * 0.3) {
      threshold = i;
      break;
    }
  }

  // Remap: pixels below threshold become white (streets = dots),
  // pixels above become dark (background = fewer dots)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = lums[p];
    if (lum <= threshold) {
      // Dark pixel (street): make bright white for stippling
      const intensity = Math.round(200 + (1 - lum / threshold) * 55);
      data[i] = intensity;
      data[i + 1] = intensity;
      data[i + 2] = intensity;
    } else {
      // Light pixel (background): make dark
      const intensity = Math.round(((lum - threshold) / (255 - threshold)) * 40);
      data[i] = intensity;
      data[i + 1] = intensity;
      data[i + 2] = intensity;
    }
    data[i + 3] = 255;
  }

  visualCtx.putImageData(imageData, 0, 0);
}

/**
 * Draw neighborhood region overlays on both canvases.
 * Visual canvas: semi-transparent white circles (add density to region areas).
 * ID canvas: flat colored circles for semantic tagging.
 */
function drawRegions(
  visualCtx: OffscreenCanvasRenderingContext2D,
  idCtx: OffscreenCanvasRenderingContext2D,
  regions: GeographicRegion[],
  idLegend: Map<string, IdEntry>,
): void {
  const S = OFFSCREEN_SIZE;

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];

    // Map normalized coordinates (0 to 1) to canvas space
    const cx = region.center_x * S;
    const cy = region.center_y * S;
    const r = region.radius * S;

    // Visual: brighter fill for higher-scoring regions (more dots there)
    const brightness = Math.round(80 + region.score * 175);
    visualCtx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.4)`;
    visualCtx.beginPath();
    visualCtx.arc(cx, cy, r, 0, Math.PI * 2);
    visualCtx.fill();

    // ID map: unique color per region
    const hex = indexToHex(i);
    idCtx.fillStyle = hex;
    idCtx.beginPath();
    idCtx.arc(cx, cy, r, 0, Math.PI * 2);
    idCtx.fill();

    idLegend.set(hex, { nodeId: region.id, role: 'evidence' });
  }
}

/**
 * Render a geographic answer as dual offscreen canvases.
 *
 * If a pre-loaded image is provided, it's drawn with contrast enhancement.
 * Regions are drawn as overlays regardless.
 *
 * @param img Pre-loaded map image (or null if image search failed)
 * @param geoSection Geographic regions data from the backend
 */
export function renderGeographic(
  img: HTMLImageElement | null,
  geoSection: GeographicRegionsSection,
): OffscreenRenderResult {
  const { visual, visualCtx, idMap, idCtx } = createCanvasPair();
  const idLegend = new Map<string, IdEntry>();

  // Draw map image with contrast boost if available
  if (img) {
    drawMapImage(visualCtx, img);
  } else {
    // No image: draw region circles on black background as the visual shape.
    // Stippling will still produce a recognizable layout from the regions alone.
    const S = OFFSCREEN_SIZE;
    for (const region of geoSection.regions) {
      const cx = region.center_x * S;
      const cy = region.center_y * S;
      const r = region.radius * S;
      const brightness = Math.round(120 + region.score * 135);
      visualCtx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
      visualCtx.beginPath();
      visualCtx.arc(cx, cy, r, 0, Math.PI * 2);
      visualCtx.fill();
    }
  }

  // Draw region overlays on both canvases
  drawRegions(visualCtx, idCtx, geoSection.regions, idLegend);

  // Phase template: center outward so the map builds from the center
  const phaseTemplate = centerOutwardPhaseTemplate(16, 6);

  return { visual, idMap, idLegend, phaseTemplate };
}

/**
 * Load a map image from URL for use with renderGeographic.
 * Returns null if the image fails to load or times out.
 */
export function loadMapImage(url: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = window.setTimeout(() => {
      img.src = '';
      resolve(null);
    }, timeoutMs);

    img.onload = () => {
      window.clearTimeout(timeout);
      resolve(img);
    };

    img.onerror = () => {
      window.clearTimeout(timeout);
      resolve(null);
    };

    img.src = url;
  });
}
