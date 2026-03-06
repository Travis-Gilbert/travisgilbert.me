import * as d3 from 'd3';

type SeriesPoint = [number, number];

type RawNation = {
  name: string;
  region: string;
  income: SeriesPoint[];
  population: SeriesPoint[];
  lifeExpectancy: SeriesPoint[];
};

type NationSeries = {
  name: string;
  region: string;
  income: [Date, number][];
  population: [Date, number][];
  lifeExpectancy: [Date, number][];
};

type NationSnapshot = {
  name: string;
  region: string;
  income: number;
  population: number;
  lifeExpectancy: number;
};

export type WealthHealthOptions = {
  dataUrl?: string;
  width?: number;
  height?: number;
};

const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 560;
const MARGIN = { top: 20, right: 20, bottom: 35, left: 40 };

function parseSeries(series: SeriesPoint[]): [Date, number][] {
  return series.map(([year, value]) => [new Date(Date.UTC(year, 0, 1)), value]);
}

const bisectDate = d3.bisector((d: [Date, number]) => d[0]).left;

function valueAt(values: [Date, number][], date: Date): number {
  const maxIndex = values.length - 1;
  if (maxIndex <= 0) return values[0]?.[1] ?? 0;

  const i = bisectDate(values, date, 0, maxIndex);
  const a = values[Math.max(0, Math.min(i, maxIndex))];
  const prevIndex = Math.max(0, Math.min(i - 1, maxIndex));
  const b = values[prevIndex];

  if (i > 0 && a && b && +b[0] !== +a[0]) {
    const t = (+date - +a[0]) / (+b[0] - +a[0]);
    return a[1] * (1 - t) + b[1] * t;
  }

  return a?.[1] ?? 0;
}

function dataAt(data: NationSeries[], date: Date): NationSnapshot[] {
  return data.map((d) => ({
    name: d.name,
    region: d.region,
    income: valueAt(d.income, date),
    population: valueAt(d.population, date),
    lifeExpectancy: valueAt(d.lifeExpectancy, date),
  }));
}

function getDateExtent(data: NationSeries[]): [Date, Date] {
  const start = d3.min(data, (d) =>
    d3.min(
      [d.income[0], d.population[0], d.lifeExpectancy[0]].filter(Boolean),
      (entry) => entry?.[0],
    ),
  );
  const end = d3.min(data, (d) =>
    d3.max(
      [
        d.income[d.income.length - 1],
        d.population[d.population.length - 1],
        d.lifeExpectancy[d.lifeExpectancy.length - 1],
      ].filter(Boolean),
      (entry) => entry?.[0],
    ),
  );

  return [
    start ?? new Date(Date.UTC(1950, 0, 1)),
    end ?? new Date(Date.UTC(2009, 0, 1)),
  ];
}

function setSvgSize(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  containerWidth: number,
  width: number,
  height: number,
): void {
  const nextWidth = Math.max(320, containerWidth);
  const nextHeight = Math.max(220, (nextWidth / width) * height);
  svg.attr('width', nextWidth).attr('height', nextHeight);
}

export function mountWealthHealth(
  el: HTMLElement,
  options: WealthHealthOptions = {},
): () => void {
  const dataUrl = options.dataUrl ?? '/charts/nations.json';
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const interval = d3.utcMonth;

  const x = d3.scaleLog<number, number>().domain([200, 1e5]).range([MARGIN.left, width - MARGIN.right]);
  const y = d3.scaleLinear<number, number>().domain([14, 86]).range([height - MARGIN.bottom, MARGIN.top]);
  const radius = d3.scaleSqrt<number, number>().domain([0, 5e8]).range([0, width / 24]);
  const color = d3.scaleOrdinal(d3.schemeCategory10).unknown('#333');

  const controller = new AbortController();

  let disposed = false;
  let timer: d3.Timer | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

  (async () => {
    const raw = await d3.json<RawNation[]>(dataUrl, {
      signal: controller.signal,
    });
    if (disposed || !raw) return;

    const data: NationSeries[] = raw.map((d) => ({
      name: d.name,
      region: d.region,
      income: parseSeries(d.income),
      population: parseSeries(d.population),
      lifeExpectancy: parseSeries(d.lifeExpectancy),
    }));

    color.domain(Array.from(new Set(data.map((d) => d.region))));

    const [startDate, endDate] = getDateExtent(data);
    const dates = interval.range(startDate, endDate);
    if (!dates.length) return;

    svg = d3
      .select(el)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Animated wealth and health bubble chart');

    setSvgSize(svg, el.clientWidth || width, width, height);

    const gridGroup = svg.append('g').attr('stroke', 'currentColor').attr('stroke-opacity', 0.11);
    gridGroup
      .append('g')
      .selectAll('line')
      .data(x.ticks())
      .join('line')
      .attr('x1', (d) => 0.5 + x(d))
      .attr('x2', (d) => 0.5 + x(d))
      .attr('y1', MARGIN.top)
      .attr('y2', height - MARGIN.bottom);

    gridGroup
      .append('g')
      .selectAll('line')
      .data(y.ticks())
      .join('line')
      .attr('y1', (d) => 0.5 + y(d))
      .attr('y2', (d) => 0.5 + y(d))
      .attr('x1', MARGIN.left)
      .attr('x2', width - MARGIN.right);

    svg
      .append('g')
      .attr('transform', `translate(0,${height - MARGIN.bottom})`)
      .call(d3.axisBottom(x).ticks(width / 80, ','))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .append('text')
          .attr('x', width)
          .attr('y', MARGIN.bottom - 4)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'end')
          .text('Income per capita (dollars) ->'),
      );

    svg
      .append('g')
      .attr('transform', `translate(${MARGIN.left},0)`)
      .call(d3.axisLeft(y))
      .call((g) => g.select('.domain').remove())
      .call((g) =>
        g
          .append('text')
          .attr('x', -MARGIN.left)
          .attr('y', 10)
          .attr('fill', 'currentColor')
          .attr('text-anchor', 'start')
          .text('-> Life expectancy (years)'),
      );

    const circles = svg
      .append('g')
      .attr('stroke', 'black')
      .attr('stroke-opacity', 0.2)
      .selectAll('circle')
      .data(dataAt(data, dates[0]), (d) => (d as NationSnapshot).name)
      .join('circle')
      .sort((a, b) => d3.descending(a.population, b.population))
      .attr('cx', (d) => x(d.income))
      .attr('cy', (d) => y(d.lifeExpectancy))
      .attr('r', (d) => radius(d.population))
      .attr('fill', (d) => color(d.region))
      .attr('fill-opacity', 0.85);

    circles.append('title').text((d) => `${d.name}\n${d.region}`);

    const yearLabel = svg
      .append('text')
      .attr('x', width - MARGIN.right)
      .attr('y', MARGIN.top + 16)
      .attr('text-anchor', 'end')
      .attr('font-family', 'var(--studio-font-mono), monospace')
      .attr('font-size', 14)
      .attr('fill', 'currentColor')
      .attr('opacity', 0.7)
      .text(dates[0].getUTCFullYear());

    const update = (date: Date) => {
      circles
        .data(dataAt(data, date), (d) => (d as NationSnapshot).name)
        .sort((a, b) => d3.descending(a.population, b.population))
        .attr('cx', (d) => x(d.income))
        .attr('cy', (d) => y(d.lifeExpectancy))
        .attr('r', (d) => radius(d.population));

      yearLabel.text(date.getUTCFullYear());
    };

    timer = d3.timer((elapsed) => {
      if (disposed) return true;
      const index = Math.floor(elapsed / 200) % dates.length;
      update(dates[index]);
      return false;
    });

    resizeObserver = new ResizeObserver((entries) => {
      if (!svg || disposed) return;
      const nextWidth = entries[0]?.contentRect.width ?? el.clientWidth;
      setSvgSize(svg, nextWidth || width, width, height);
    });
    resizeObserver.observe(el);
  })().catch((error: unknown) => {
    if ((error as { name?: string }).name === 'AbortError') return;
    // Surface load errors for embed usage while keeping cleanup safe.
    if (!disposed) {
      el.textContent = 'Unable to load chart data.';
    }
  });

  return () => {
    disposed = true;
    controller.abort();
    timer?.stop();
    resizeObserver?.disconnect();
    svg?.remove();
    el.replaceChildren();
  };
}

