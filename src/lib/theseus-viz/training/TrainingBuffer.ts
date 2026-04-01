/* SPEC-VIE-3 v3: Batches feedback for model updates */

import type { VizFeedback } from '../SceneDirective';
import { RENDER_TARGETS, TOPOLOGY_SHAPES } from '../SceneDirective';

const DB_NAME = 'theseus-viz';
const STORE_NAME = 'feedback';
const BATCH_SIZE = 50;

export interface TrainingSample {
  graph_features: number[];   // [16]
  data_features: number[];    // [10]
  node_count: number;
  render_target_label: number;
  topology_label: number;
  engagement_score: number;
}

export interface TrainingBatch {
  samples: TrainingSample[];
  collected_at: string;
}

class TrainingBuffer {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  async addFeedback(feedback: VizFeedback): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(feedback);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      const count = await this.count();
      if (count >= BATCH_SIZE) {
        await this.submitBatch();
      }
    } catch {
      // IndexedDB not available (SSR or permissions)
    }
  }

  async count(): Promise<number> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).count();
      return new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
    } catch {
      return 0;
    }
  }

  async submitBatch(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      const feedbacks: VizFeedback[] = await new Promise((resolve) => {
        req.onsuccess = () => resolve(req.result as VizFeedback[]);
        req.onerror = () => resolve([]);
      });

      if (feedbacks.length === 0) return;

      const samples: TrainingSample[] = feedbacks.map(f => ({
        graph_features: new Array(16).fill(0),
        data_features: new Array(10).fill(0),
        node_count: f.node_count,
        render_target_label: RENDER_TARGETS.indexOf(f.render_target_used as typeof RENDER_TARGETS[number]),
        topology_label: TOPOLOGY_SHAPES.indexOf(f.topology_primary),
        engagement_score: computeEngagement(f),
      }));

      const batch: TrainingBatch = {
        samples,
        collected_at: new Date().toISOString(),
      };

      // TODO: POST to API endpoint when available
      void batch;

      // Clear submitted records
      const clearTx = db.transaction(STORE_NAME, 'readwrite');
      clearTx.objectStore(STORE_NAME).clear();
      await new Promise<void>((resolve) => {
        clearTx.oncomplete = () => resolve();
        clearTx.onerror = () => resolve();
      });
    } catch {
      // Silent failure
    }
  }
}

function computeEngagement(f: VizFeedback): number {
  let score = 0.3;
  if (f.nodes_clicked_within_3s.length > 0) score += 0.2;
  score += Math.min(0.2, f.what_if_removals * 0.1);
  if (f.follow_ups_asked > 0) score += 0.1;
  if (f.model_saved || f.gif_exported) score += 0.1;
  if (f.thumbs === 'up') score += 0.2;
  if (f.thumbs === 'down') score -= 0.3;
  return Math.max(0, Math.min(1, score));
}

export const trainingBuffer = new TrainingBuffer();
