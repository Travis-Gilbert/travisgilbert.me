export type SpacetimeEvent = {
  id: string;
  label: string;
  year: number;
  latitude?: number | null;
  longitude?: number | null;
  weight?: number;
};

export type TimeWindow = {
  startYear: number;
  endYear: number;
};

export type PeriodComparison = {
  first: SpacetimeEvent[];
  second: SpacetimeEvent[];
  sharedLabels: string[];
  onlyFirst: SpacetimeEvent[];
  onlySecond: SpacetimeEvent[];
};

export function eventsInWindow(
  events: SpacetimeEvent[],
  window: TimeWindow,
): SpacetimeEvent[] {
  return events.filter(
    (event) => event.year >= window.startYear && event.year <= window.endYear,
  );
}

export function comparePeriods(
  events: SpacetimeEvent[],
  firstWindow: TimeWindow,
  secondWindow: TimeWindow,
): PeriodComparison {
  const first = eventsInWindow(events, firstWindow);
  const second = eventsInWindow(events, secondWindow);
  const firstLabels = new Set(first.map((event) => event.label));
  const secondLabels = new Set(second.map((event) => event.label));

  return {
    first,
    second,
    sharedLabels: [...firstLabels].filter((label) => secondLabels.has(label)).sort(),
    onlyFirst: first.filter((event) => !secondLabels.has(event.label)),
    onlySecond: second.filter((event) => !firstLabels.has(event.label)),
  };
}
