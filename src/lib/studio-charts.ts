export interface ChartEmbed {
  slug: string;
  title: string;
  description: string;
  url: string;
  previewUrl: string;
  defaultHeight: number;
}

export const CHART_REGISTRY: ChartEmbed[] = [
  {
    slug: 'wealth-health',
    title: 'Wealth & Health of Nations',
    description: 'Animated bubble chart: GDP vs life expectancy over time',
    url: '/embed/wealth-health/',
    previewUrl: '/embed/wealth-health/',
    defaultHeight: 580,
  },
];
