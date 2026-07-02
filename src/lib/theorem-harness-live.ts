export type HarnessLiveSource = 'live' | 'unavailable';

export interface HarnessLiveCounts {
  presence: number;
  intents: number;
  messages: number;
  records: number;
  pendingMentions: number;
  memory: number;
}

export interface HarnessLiveMemoryDoc {
  id: string;
  kind: string;
  title: string;
  excerpt: string;
  servedTier?: string;
  status?: string;
  fitness?: number;
  updatedAt?: string;
}

export interface HarnessLiveActivity {
  id: string;
  kind: 'message' | 'record' | 'intent' | 'presence';
  title: string;
  summary: string;
  actor?: string;
  updatedAt?: string;
}

export interface HarnessLiveSummary {
  source: HarnessLiveSource;
  tenant: string;
  roomId: string;
  generatedAt: string;
  sourceLabel: string;
  counts: HarnessLiveCounts;
  memory: HarnessLiveMemoryDoc[];
  activity: HarnessLiveActivity[];
  attempts?: string[];
}

export async function fetchHarnessLiveSummary(signal?: AbortSignal): Promise<HarnessLiveSummary> {
  const response = await fetch('/api/theorem/harness/summary', {
    cache: 'no-store',
    signal,
  });
  if (!response.ok) {
    throw new Error(`Harness summary returned ${response.status}.`);
  }
  return response.json() as Promise<HarnessLiveSummary>;
}
