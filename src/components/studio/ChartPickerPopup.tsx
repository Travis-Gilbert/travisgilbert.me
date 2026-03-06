'use client';

import { useEffect, useRef } from 'react';
import { CHART_REGISTRY, type ChartEmbed } from '@/lib/studio-charts';

interface ChartPickerPopupProps {
  onSelect: (chart: ChartEmbed) => void;
  onClose: () => void;
}

export default function ChartPickerPopup({ onSelect, onClose }: ChartPickerPopupProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="studio-chart-picker">
      <div className="studio-chart-picker-header">Charts</div>
      <div className="studio-chart-picker-grid">
        {CHART_REGISTRY.map((chart) => (
          <button
            key={chart.slug}
            type="button"
            className="studio-chart-picker-card"
            onClick={() => onSelect(chart)}
          >
            <div className="studio-chart-picker-preview">
              <iframe
                src={chart.previewUrl}
                title={chart.title}
                sandbox="allow-scripts"
                loading="lazy"
              />
            </div>
            <div className="studio-chart-picker-info">
              <span className="studio-chart-picker-title">{chart.title}</span>
              <span className="studio-chart-picker-desc">{chart.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
