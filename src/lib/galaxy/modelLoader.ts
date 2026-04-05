/**
 * Singleton lazy loaders for TF.js vision models.
 *
 * Each model downloads once on first use, then stays cached for the
 * session. Vision models are NOT warmed up on app load (too heavy);
 * they load on-demand when an image appears in an answer.
 */

import type { FaceLandmarksDetector } from '@tensorflow-models/face-landmarks-detection';
import type { BodySegmenter } from '@tensorflow-models/body-segmentation';
import type { DepthEstimator } from '@tensorflow-models/depth-estimation';
import type { ObjectDetection } from '@tensorflow-models/coco-ssd';

let _faceModel: FaceLandmarksDetector | null = null;
let _segmentModel: BodySegmenter | null = null;
let _depthModel: DepthEstimator | null = null;
let _cocoModel: ObjectDetection | null = null;

async function ensureTfReady(): Promise<void> {
  const tf = await import('@tensorflow/tfjs');
  await tf.ready();
}

export async function getFaceModel(): Promise<FaceLandmarksDetector> {
  if (_faceModel) return _faceModel;
  await ensureTfReady();
  const fld = await import('@tensorflow-models/face-landmarks-detection');
  _faceModel = await fld.createDetector(
    fld.SupportedModels.MediaPipeFaceMesh,
    { runtime: 'tfjs', refineLandmarks: false, maxFaces: 1 },
  );
  return _faceModel;
}

export async function getSegmentModel(): Promise<BodySegmenter> {
  if (_segmentModel) return _segmentModel;
  await ensureTfReady();
  const bs = await import('@tensorflow-models/body-segmentation');
  _segmentModel = await bs.createSegmenter(
    bs.SupportedModels.MediaPipeSelfieSegmentation,
    { runtime: 'tfjs', modelType: 'general' },
  );
  return _segmentModel;
}

export async function getDepthModel(): Promise<DepthEstimator> {
  if (_depthModel) return _depthModel;
  await ensureTfReady();
  const de = await import('@tensorflow-models/depth-estimation');
  _depthModel = await de.createEstimator(de.SupportedModels.ARPortraitDepth);
  return _depthModel;
}

export async function getCocoModel(): Promise<ObjectDetection> {
  if (_cocoModel) return _cocoModel;
  await ensureTfReady();
  const coco = await import('@tensorflow-models/coco-ssd');
  _cocoModel = await coco.load();
  return _cocoModel;
}

/** Dispose all cached models and free GPU memory. */
export function disposeAllModels(): void {
  if (_faceModel) { _faceModel.dispose(); _faceModel = null; }
  if (_segmentModel) { _segmentModel.dispose(); _segmentModel = null; }
  if (_depthModel) { _depthModel.dispose(); _depthModel = null; }
  if (_cocoModel) { _cocoModel.dispose(); _cocoModel = null; }
}
