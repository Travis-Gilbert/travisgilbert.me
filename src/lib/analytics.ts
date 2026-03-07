import type { ContentEntry, Essay, FieldNote, ShelfEntry } from './content';

export interface WritingStats {
  totalEssays: number;
  totalFieldNotes: number;
  totalWords: number;
  averageWordsPerEssay: number;
  essaysByMonth: { month: string; count: number; cumulative: number }[];
  essaysByStage: { stage: string; count: number }[];
  topTags: { tag: string; count: number }[];
  connectionDensity: number;
  oldestEssay: { title: string; date: string } | null;
  newestEssay: { title: string; date: string } | null;
  longestEssay: { title: string; wordCount: number } | null;
  totalShelfItems: number;
}

function wordCount(body: string): number {
  return body.trim().split(/\s+/).length;
}

export function computeWritingStats(
  essays: ContentEntry<Essay>[],
  fieldNotes: ContentEntry<FieldNote>[],
  shelf: ContentEntry<ShelfEntry>[],
): WritingStats {
  // Word counts
  const essayWords = essays.map((e) => ({
    title: e.data.title,
    words: wordCount(e.body),
    date: e.data.date,
    tags: e.data.tags,
    stage: e.data.stage,
  }));

  const totalWords = essayWords.reduce((sum, e) => sum + e.words, 0);

  // Sort by date for timeline
  const sorted = [...essayWords].sort(
    (a, b) => a.date.valueOf() - b.date.valueOf()
  );

  // Monthly counts
  const monthMap = new Map<string, number>();
  for (const e of sorted) {
    const d = e.date;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
  }

  let cumulative = 0;
  const essaysByMonth = Array.from(monthMap.entries()).map(([month, count]) => {
    cumulative += count;
    return { month, count, cumulative };
  });

  // Stage counts
  const stageMap = new Map<string, number>();
  for (const e of essayWords) {
    const stage = e.stage ?? 'unknown';
    stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
  }
  const essaysByStage = Array.from(stageMap.entries()).map(
    ([stage, count]) => ({ stage, count })
  );

  // Tag frequency
  const tagMap = new Map<string, number>();
  for (const e of essayWords) {
    for (const tag of e.tags) {
      tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));

  // Extremes
  const longestEssay = essayWords.length > 0
    ? essayWords.reduce((max, e) => (e.words > max.words ? e : max))
    : null;

  return {
    totalEssays: essays.length,
    totalFieldNotes: fieldNotes.length,
    totalShelfItems: shelf.length,
    totalWords,
    averageWordsPerEssay: essays.length > 0 ? Math.round(totalWords / essays.length) : 0,
    essaysByMonth,
    essaysByStage,
    topTags,
    connectionDensity: 0,
    oldestEssay: sorted[0]
      ? { title: sorted[0].title, date: sorted[0].date.toISOString() }
      : null,
    newestEssay: sorted[sorted.length - 1]
      ? { title: sorted[sorted.length - 1].title, date: sorted[sorted.length - 1].date.toISOString() }
      : null,
    longestEssay: longestEssay
      ? { title: longestEssay.title, wordCount: longestEssay.words }
      : null,
  };
}
