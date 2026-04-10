'use client';

import { useState, useCallback } from 'react';

export interface AlgorithmParams {
  personalWeight: number;
  traversalDepth: number;
  recencyBias: number;
  signalMix: number;
}

const DEFAULTS: AlgorithmParams = {
  personalWeight: 1.5,
  traversalDepth: 2,
  recencyBias: 0.3,
  signalMix: 0.5,
};

interface AlgorithmSettingsProps {
  onChange?: (params: AlgorithmParams) => void;
}

/**
 * AlgorithmSettings: sliders for graph algorithm parameters.
 *
 * Each slider maps to a parameter in the ask pipeline's retrieval configuration.
 * Changes take effect immediately on the Graph tab.
 * Per-session preferences, not persisted.
 */
export default function AlgorithmSettings({ onChange }: AlgorithmSettingsProps) {
  const [params, setParams] = useState<AlgorithmParams>(DEFAULTS);

  const update = useCallback(
    (key: keyof AlgorithmParams, value: number) => {
      setParams((prev) => {
        const next = { ...prev, [key]: value };
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  return (
    <div className="notebook-settings">
      <SettingSlider
        label="Personal weight"
        min={0.5}
        max={3}
        step={0.1}
        value={params.personalWeight}
        onChange={(v) => update('personalWeight', v)}
      />
      <SettingSlider
        label="Traversal depth"
        min={1}
        max={3}
        step={1}
        value={params.traversalDepth}
        onChange={(v) => update('traversalDepth', v)}
      />
      <SettingSlider
        label="Recency bias"
        min={0}
        max={1}
        step={0.1}
        value={params.recencyBias}
        onChange={(v) => update('recencyBias', v)}
      />
      <SettingSlider
        label="Signal mix (BM25 vs SBERT)"
        min={0}
        max={1}
        step={0.05}
        value={params.signalMix}
        onChange={(v) => update('signalMix', v)}
      />
    </div>
  );
}

function SettingSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="notebook-setting-row">
      <div className="notebook-setting-header">
        <span className="notebook-setting-label">{label}</span>
        <span className="notebook-setting-value">{value.toFixed(step < 1 ? 1 : 0)}</span>
      </div>
      <input
        type="range"
        className="notebook-setting-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
