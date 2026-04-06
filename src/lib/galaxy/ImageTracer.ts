/**
 * Image-to-particle target tracing via TF.js Sobel edge detection.
 *
 * Loads a reference image, runs Sobel edge detection to find edges,
 * then samples edge positions as particle targets. The result is an
 * array of normalized (0-1) coordinates where dots should cluster
 * to form the recognizable shape.
 */

import { mulberry32 } from '@/lib/prng';

type TFModule = typeof import('@tensorflow/tfjs');

export interface ParticleTarget {
  x: number;
  y: number;
  weight: number;
}

let _tf: TFModule | null = null;

async function loadTF(): Promise<TFModule> {
  if (_tf) return _tf;
  _tf = await import('@tensorflow/tfjs');
  return _tf;
}

export interface ImageTraceOptions {
  edgeThreshold?: number;
  /** Apply map-optimized contrast boost (thresholds streets vs background) */
  contrastBoost?: 'map' | 'none';
}

/**
 * Load an image and extract edge positions for particle targeting.
 *
 * @param imageUrl URL of the reference image (must support CORS)
 * @param targetCount Desired number of target positions
 * @param options Edge threshold and optional contrast preprocessing
 */
export async function traceImageToTargets(
  imageUrl: string,
  targetCount: number,
  options: ImageTraceOptions = {},
): Promise<ParticleTarget[]> {
  const { edgeThreshold = 0.08, contrastBoost = 'none' } = options;
  const tf = await loadTF();

  const img = await loadImage(imageUrl);

  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context from OffscreenCanvas');
  ctx.drawImage(img, 0, 0, w, h);

  // Map contrast boost: adaptive threshold that separates streets from background.
  // CARTO light tiles have light-gray streets (~190) on white (~245). A fixed
  // threshold at 128 misses them entirely. Instead, compute the image's luminance
  // histogram and set the threshold at the 30th percentile so the darkest ~30%
  // of pixels (streets, boundaries) become very dark and everything else becomes
  // very light, giving the Sobel filter clean edges.
  if (contrastBoost === 'map') {
    const preData = ctx.getImageData(0, 0, w, h);
    const pixels = preData.data;

    // Build luminance histogram to find adaptive threshold
    const histogram = new Uint32Array(256);
    for (let i = 0; i < pixels.length; i += 4) {
      const lum = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
      histogram[lum]++;
    }

    // Find the 30th percentile luminance (streets are the darkest features)
    const totalPixels = (pixels.length / 4);
    const targetCount = totalPixels * 0.30;
    let cumulative = 0;
    let threshold = 128; // fallback
    for (let lum = 0; lum < 256; lum++) {
      cumulative += histogram[lum];
      if (cumulative >= targetCount) {
        threshold = lum;
        break;
      }
    }

    // Apply threshold: below = very dark (streets), above = very light (background)
    for (let i = 0; i < pixels.length; i += 4) {
      const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      const adjusted = lum <= threshold
        ? Math.max(0, (lum / threshold) * 40)    // streets: compress to 0-40
        : Math.min(255, 200 + ((lum - threshold) / (255 - threshold)) * 55); // background: 200-255
      pixels[i] = adjusted;
      pixels[i + 1] = adjusted;
      pixels[i + 2] = adjusted;
    }
    ctx.putImageData(preData, 0, 0);
  }

  const imageData = ctx.getImageData(0, 0, w, h);

  // tf.tidy disposes all intermediate tensors created inside the callback,
  // preventing leaks from chained operations like .slice().mul().add()
  const edgeData = tf.tidy(() => {
    const rgba = tf.tensor3d(
      new Uint8Array(imageData.data),
      [h, w, 4],
    );

    // Luminance: 0.299R + 0.587G + 0.114B
    const gray = rgba
      .slice([0, 0, 0], [-1, -1, 1]).mul(0.299)
      .add(rgba.slice([0, 0, 1], [-1, -1, 1]).mul(0.587))
      .add(rgba.slice([0, 0, 2], [-1, -1, 1]).mul(0.114))
      .toFloat()
      .div(255) as import('@tensorflow/tfjs').Tensor3D;

    return sobelEdgeDetect(tf, gray);
  });

  const data = await edgeData.data();
  edgeData.dispose();

  return sampleEdgePositions(data as Float32Array, w, h, targetCount, edgeThreshold);
}

function sobelEdgeDetect(tf: TFModule, grayscale: import('@tensorflow/tfjs').Tensor3D): import('@tensorflow/tfjs').Tensor2D {
  const sobelX = tf.tensor4d([-1, 0, 1, -2, 0, 2, -1, 0, 1], [3, 3, 1, 1]);
  const sobelY = tf.tensor4d([-1, -2, -1, 0, 0, 0, 1, 2, 1], [3, 3, 1, 1]);

  const input = grayscale.expandDims(0) as import('@tensorflow/tfjs').Tensor4D;
  const gx = tf.conv2d(input, sobelX, 1, 'same');
  const gy = tf.conv2d(input, sobelY, 1, 'same');
  const magnitude = tf.sqrt(tf.add(tf.square(gx), tf.square(gy)));

  const maxVal = magnitude.max();
  const normalized = magnitude.div(maxVal.add(1e-6));

  return normalized.squeeze([0, 3]) as import('@tensorflow/tfjs').Tensor2D;
}

function sampleEdgePositions(
  edgeData: Float32Array,
  width: number,
  height: number,
  targetCount: number,
  threshold: number,
): ParticleTarget[] {
  const candidates: ParticleTarget[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const val = edgeData[y * width + x];
      if (val > threshold) {
        candidates.push({ x: x / width, y: y / height, weight: val });
      }
    }
  }

  if (candidates.length === 0) return [];
  if (candidates.length <= targetCount) return candidates;

  return weightedReservoirSample(candidates, targetCount);
}

/**
 * Weighted reservoir sampling (Algorithm A-Res, Efraimidis and Spirakis).
 * Uses seeded PRNG for deterministic results across renders.
 */
function weightedReservoirSample(
  items: ParticleTarget[],
  count: number,
): ParticleTarget[] {
  const rng = mulberry32(items.length * 7919 + count);
  const keyed = items.map((item) => ({
    item,
    key: Math.pow(rng(), 1 / Math.max(item.weight, 0.001)),
  }));

  keyed.sort((a, b) => b.key - a.key);
  return keyed.slice(0, count).map((k) => k.item);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
