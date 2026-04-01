/* SPEC-VIE-3: Data-shape feature extraction (10 dimensions) */

import type { DataShape } from '../SceneSpec';

/**
 * Dimension 0: has_geographic (0/1)
 * Dimension 1: has_temporal (0/1)
 * Dimension 2: has_categorical (0/1)
 * Dimension 3: has_numeric (0/1)
 * Dimension 4: row_count (log10, normalized to 0-1 where 1 = 1M rows)
 * Dimension 5: column_count (normalized, 1.0 = 50 columns)
 * Dimension 6: numeric_column_ratio (numeric cols / total cols)
 * Dimension 7: max_cardinality (highest unique_count in categorical cols, log-scaled)
 * Dimension 8: is_timeseries (1.0 if has_temporal AND has_numeric AND rows > 10)
 * Dimension 9: is_spatial (1.0 if has_geographic AND numeric value field exists)
 */
export const DATA_FEATURE_DIM = 10;

export function extractDataFeatures(dataShape: DataShape | null): Float32Array {
  const features = new Float32Array(DATA_FEATURE_DIM);
  if (!dataShape) return features;

  features[0] = dataShape.has_geographic ? 1.0 : 0.0;
  features[1] = dataShape.has_temporal ? 1.0 : 0.0;
  features[2] = dataShape.has_categorical ? 1.0 : 0.0;
  features[3] = dataShape.has_numeric ? 1.0 : 0.0;

  // 4: row_count (log10, 1.0 = 1M rows)
  features[4] = Math.min(1, Math.log10(Math.max(1, dataShape.row_count)) / 6);

  // 5: column_count (1.0 = 50 columns)
  features[5] = Math.min(1, dataShape.columns.length / 50);

  // 6: numeric_column_ratio
  const numericCols = dataShape.columns.filter(c => c.type === 'numeric').length;
  features[6] = dataShape.columns.length > 0 ? numericCols / dataShape.columns.length : 0;

  // 7: max_cardinality (log-scaled, 1.0 = 10000 unique values)
  const catCols = dataShape.columns.filter(c => c.type === 'categorical');
  const maxCard = Math.max(0, ...catCols.map(c => c.unique_count || 0));
  features[7] = maxCard > 0 ? Math.min(1, Math.log10(maxCard) / 4) : 0;

  // 8: is_timeseries
  features[8] = dataShape.has_temporal && dataShape.has_numeric && dataShape.row_count > 10
    ? 1.0 : 0.0;

  // 9: is_spatial
  features[9] = dataShape.has_geographic && dataShape.has_numeric ? 1.0 : 0.0;

  return features;
}
