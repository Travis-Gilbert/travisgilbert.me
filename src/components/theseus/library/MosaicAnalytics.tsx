'use client';

import type { FC } from 'react';
import WidgetShell from '@/components/theseus/intelligence/widgets/WidgetShell';
import MosaicWidget from '@/components/theseus/intelligence/widgets/MosaicWidget';
import { useWidgetData } from '@/components/theseus/intelligence/widgets/useWidgetData';

/**
 * Library-level analytics strip. The `/api/v2/theseus/library/analytics/`
 * endpoint returns a Mosaic spec that composes three sub-plots
 * (objects-by-type, ingestion velocity, source breakdown).
 */
const MosaicAnalytics: FC = () => {
  const { data, state, error } = useWidgetData<{ spec: unknown }>(
    '/api/v2/theseus/library/analytics/',
  );
  return (
    <div style={{ padding: '12px 0' }}>
      <WidgetShell title="Library · analytics" state={state} error={error}>
        {data?.spec ? <MosaicWidget spec={data.spec} /> : null}
      </WidgetShell>
    </div>
  );
};

export default MosaicAnalytics;
