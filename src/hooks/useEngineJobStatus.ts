'use client';

import { useEffect, useState } from 'react';
import { fetchEngineJobStatus } from '@/lib/commonplace-api';
import type { ApiEngineJobStatus } from '@/lib/commonplace';

interface UseEngineJobStatusResult {
  job: ApiEngineJobStatus | null;
  loading: boolean;
}

const RUNNING_STATES = new Set(['queued', 'running']);

export function useEngineJobStatus(
  jobId: string | null,
): UseEngineJobStatusResult {
  const [job, setJob] = useState<ApiEngineJobStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    let timeoutId: number | null = null;

    const poll = async () => {
      if (!cancelled) setLoading(true);

      try {
        const next = await fetchEngineJobStatus(jobId);
        if (cancelled) return;

        setJob(next);
        if (RUNNING_STATES.has(next.status)) {
          timeoutId = window.setTimeout(poll, 1600);
        }
      } catch {
        if (cancelled) return;
        timeoutId = window.setTimeout(poll, 2400);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [jobId]);

  return { job, loading };
}
