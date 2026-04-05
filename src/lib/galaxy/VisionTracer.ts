/**
 * Vision-driven particle target generation using TF.js models.
 *
 * Produces semantically meaningful ParticleTargets by understanding
 * WHAT is in the image (faces, objects) rather than just finding edges.
 * Falls back gracefully: person trace -> object trace -> empty (caller
 * falls through to Sobel in ImageTracer).
 *
 * Weight encodes construction phase for person targets:
 *   0.00-0.25  silhouette (body boundary)
 *   0.25-0.50  facial structure (eyes, nose, lips, jawline)
 *   0.50-0.75  interior mesh fill
 *   0.75-1.00  depth-weighted detail
 */

import type { ParticleTarget } from './ImageTracer';
import { getFaceModel, getSegmentModel, getDepthModel, getCocoModel } from './modelLoader';
import { extractUniqueEdges, classifyEdge, type MeshEdge } from './faceMeshTriangulation';
import { mulberry32 } from '@/lib/prng';

export type VisionMode = 'person' | 'object' | 'none';

export interface VisionTraceResult {
  targets: ParticleTarget[];
  mode: VisionMode;
  /** COCO-SSD class labels parallel to targets (object mode only) */
  objectLabels?: string[];
}

const MAX_DIM = 256;

// Cache edges once (they never change)
let _meshEdges: MeshEdge[] | null = null;
function getMeshEdges(): MeshEdge[] {
  if (!_meshEdges) _meshEdges = extractUniqueEdges();
  return _meshEdges;
}

/**
 * Main entry point. Tries person detection first, then object detection.
 * Returns empty result if nothing detected (caller should fall through to Sobel).
 */
export async function traceVision(
  imageUrl: string,
  targetCount: number,
): Promise<VisionTraceResult> {
  const { canvas, width, height } = await loadAndScale(imageUrl);

  // Try person trace (face mesh + body segmentation + depth)
  try {
    const personTargets = await tracePersonTargets(canvas, width, height, targetCount);
    if (personTargets.length >= 50) {
      return { targets: personTargets, mode: 'person' };
    }
  } catch (err) {
    console.warn('[VisionTracer] Person trace failed:', err);
  }

  // Try object detection
  try {
    const { targets, labels } = await traceObjectTargets(canvas, width, height, targetCount);
    if (targets.length >= 20) {
      return { targets, mode: 'object', objectLabels: labels };
    }
  } catch (err) {
    console.warn('[VisionTracer] Object trace failed:', err);
  }

  return { targets: [], mode: 'none' };
}

// ---------------------------------------------------------------------------
// Person trace: face mesh wireframe + body segmentation + depth
// ---------------------------------------------------------------------------

async function tracePersonTargets(
  canvas: OffscreenCanvas,
  width: number,
  height: number,
  targetCount: number,
): Promise<ParticleTarget[]> {
  // Run models in parallel where possible
  const [faceModel, segmentModel] = await Promise.all([
    getFaceModel(),
    getSegmentModel(),
  ]);

  // Face detection needs an HTMLImageElement or ImageData
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, width, height);

  const [faces, segmentations] = await Promise.all([
    faceModel.estimateFaces(imageData, { staticImageMode: true }),
    segmentModel.segmentPeople(imageData),
  ]);

  if (faces.length === 0 || faces[0].keypoints.length === 0) {
    return [];
  }

  const keypoints = faces[0].keypoints;

  // Build body mask from segmentation, then dispose the mask tensor
  let bodyMask: Uint8Array | null = null;
  if (segmentations.length > 0 && segmentations[0].mask) {
    const mask = segmentations[0].mask;
    const maskImageData = await mask.toImageData();
    // Dispose the underlying tensor now that we have plain ImageData
    if (mask.getUnderlyingType() === 'tensor') {
      const tensor = await mask.toTensor();
      tensor.dispose();
    }
    bodyMask = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      // MediaPipe SelfieSegmentation: R channel > 128 = person
      bodyMask[i] = maskImageData.data[i * 4] > 128 ? 1 : 0;
    }
  }

  // Try depth estimation (portrait-specific, may fail for non-portraits)
  let depthMap: number[][] | null = null;
  try {
    const depthModel = await getDepthModel();
    const depth = await depthModel.estimateDepth(imageData, {
      minDepth: 0,
      maxDepth: 1,
    });
    depthMap = await depth.toArray();
    // Dispose the underlying depth tensor
    if (depth.getUnderlyingType() === 'tensor') {
      const tensor = await depth.toTensor();
      tensor.dispose();
    }
  } catch {
    // Depth estimation failed; we'll use uniform depth
  }

  // Interpolate along mesh edges to create wireframe targets
  const edges = getMeshEdges();
  const candidates: ParticleTarget[] = [];
  const stepsPerEdge = 20; // 0.05 step size

  for (const [v0, v1] of edges) {
    if (v0 >= keypoints.length || v1 >= keypoints.length) continue;

    const kp0 = keypoints[v0];
    const kp1 = keypoints[v1];

    // Classify edge for phase encoding
    const edgeClass = classifyEdge(v0, v1);

    for (let step = 0; step <= stepsPerEdge; step++) {
      const t = step / stepsPerEdge;
      const px = kp0.x + (kp1.x - kp0.x) * t;
      const py = kp0.y + (kp1.y - kp0.y) * t;

      // Pixel coordinates for mask/depth sampling
      const ix = Math.round(px);
      const iy = Math.round(py);

      // Skip points outside canvas bounds
      if (ix < 0 || ix >= width || iy < 0 || iy >= height) continue;

      // Skip points outside body mask (if available)
      if (bodyMask && bodyMask[iy * width + ix] === 0) continue;

      // Sample depth (0 = far, 1 = near in ARPortraitDepth)
      let depthVal = 0.5;
      if (depthMap && depthMap.length > 0 && iy < depthMap.length && ix < depthMap[0].length) {
        depthVal = depthMap[iy][ix];
      }

      // Encode phase in weight based on edge classification + depth
      let weight: number;
      if (edgeClass === 0) {
        // Silhouette: weight 0.00-0.25
        weight = depthVal * 0.25;
      } else if (edgeClass === 1) {
        // Structural features: weight 0.25-0.50
        weight = 0.25 + depthVal * 0.25;
      } else {
        // Interior mesh: weight 0.50-0.75 (base) or 0.75-1.00 (high depth)
        weight = depthVal > 0.6
          ? 0.75 + (depthVal - 0.6) * 0.625  // 0.75-1.00
          : 0.50 + depthVal * 0.417;           // 0.50-0.75
      }

      candidates.push({
        x: px / width,   // Normalize to 0-1
        y: py / height,
        weight: Math.max(0, Math.min(1, weight)),
      });
    }
  }

  if (candidates.length === 0) return [];
  if (candidates.length <= targetCount) return candidates;

  return weightedReservoirSample(candidates, targetCount);
}

// ---------------------------------------------------------------------------
// Object trace: COCO-SSD bounding boxes + depth
// ---------------------------------------------------------------------------

async function traceObjectTargets(
  canvas: OffscreenCanvas,
  width: number,
  height: number,
  targetCount: number,
): Promise<{ targets: ParticleTarget[]; labels: string[] }> {
  const cocoModel = await getCocoModel();
  const ctx = canvas.getContext('2d')!;
  const imageData = ctx.getImageData(0, 0, width, height);

  const detections = await cocoModel.detect(imageData, 10, 0.5);

  if (detections.length === 0) {
    return { targets: [], labels: [] };
  }

  // Optional depth for weight values
  let depthMap: number[][] | null = null;
  try {
    const depthModel = await getDepthModel();
    const depth = await depthModel.estimateDepth(imageData, {
      minDepth: 0,
      maxDepth: 1,
    });
    depthMap = await depth.toArray();
    if (depth.getUnderlyingType() === 'tensor') {
      const tensor = await depth.toTensor();
      tensor.dispose();
    }
  } catch {
    // Depth failed; use uniform weight
  }

  const rng = mulberry32(detections.length * 3571 + targetCount);
  const targets: ParticleTarget[] = [];
  const labels: string[] = [];

  // Allocate dots proportionally to detection confidence * bbox area
  const totalArea = detections.reduce((sum, d) => sum + d.bbox[2] * d.bbox[3], 0);
  const objectDots = Math.floor(targetCount * 0.85); // 85% for objects
  const ambientDots = targetCount - objectDots;       // 15% ambient fill

  for (const det of detections) {
    const [bx, by, bw, bh] = det.bbox;
    const area = bw * bh;
    const dotAlloc = Math.max(10, Math.floor(objectDots * (area / totalArea)));

    // Dense grid within bounding box
    for (let i = 0; i < dotAlloc; i++) {
      const px = bx + rng() * bw;
      const py = by + rng() * bh;

      const ix = Math.round(px);
      const iy = Math.round(py);

      let weight = 0.5 + det.score * 0.3;
      if (depthMap && iy >= 0 && iy < depthMap.length && ix >= 0 && ix < depthMap[0].length) {
        weight = 0.3 + depthMap[iy][ix] * 0.5 + det.score * 0.2;
      }

      targets.push({
        x: px / width,
        y: py / height,
        weight: Math.max(0, Math.min(1, weight)),
      });
      labels.push(det.class);
    }
  }

  // Sparse ambient fill outside bounding boxes
  for (let i = 0; i < ambientDots; i++) {
    targets.push({
      x: rng(),
      y: rng(),
      weight: 0.05 + rng() * 0.1,
    });
    labels.push('ambient');
  }

  return { targets, labels };
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

async function loadAndScale(imageUrl: string): Promise<{
  canvas: OffscreenCanvas;
  width: number;
  height: number;
}> {
  const img = await loadImage(imageUrl);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2D context from OffscreenCanvas');
  ctx.drawImage(img, 0, 0, w, h);
  return { canvas, width: w, height: h };
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

/**
 * Weighted reservoir sampling (Algorithm A-Res).
 * Deterministic via mulberry32 seed.
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
