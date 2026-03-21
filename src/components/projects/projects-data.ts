export interface ProjectCardData {
  slug: string;
  title: string;
  subtitle?: string;
  description: string;
  callout?: string;
  date: string;
  organization?: string;
  role: string;
  roleColor: string;
  href: string;
  visual: string;
  theme: 'dark' | 'warm' | 'warm-teal' | 'warm-gold' | 'warm-green' | 'warm-purple';
  poweredBy?: string;
  gridSpan?: 'top-left' | 'top-right';
}

export const TOP_ROW: ProjectCardData[] = [
  {
    slug: 'theseus',
    title: 'Theseus',
    subtitle: 'The Epistemic Engine',
    description:
      'You feed it research. It finds what contradicts, what connects, and what\u2019s missing. Six independent analysis passes chain together, track provenance, and surface structural holes no human reader would catch.',
    callout: 'Built to reason, not retrieve.',
    date: '2025 \u2013 Present',
    role: 'Built & Designed',
    roleColor: '--color-engine-accent',
    href: '/projects/theseus',
    visual: 'theseus',
    theme: 'dark',
    gridSpan: 'top-left',
  },
  {
    slug: 'commonplace',
    title: 'CommonPlace',
    subtitle: 'A Knowledge Workbench',
    description:
      'Every knowledge worker has a graveyard. Abandoned Notion databases, dead Roam graphs, Obsidian vaults nobody tends. CommonPlace is the system that keeps itself alive. The engine does the connecting you always meant to do manually. Objects cluster without folders. Forgotten work resurfaces when it matters again.',
    callout: 'Objects exist. Nodes happen.',
    date: '2025 \u2013 Present',
    role: 'Created',
    roleColor: '--color-teal',
    href: '/commonplace',
    visual: 'commonplace',
    theme: 'warm',
    poweredBy: 'Theseus',
    gridSpan: 'top-right',
  },
];

export const MIDDLE_ROW: ProjectCardData[] = [
  {
    slug: 'index-api',
    title: 'Index-API',
    subtitle: 'Research Infrastructure',
    description:
      'The Django backend that powers Theseus and CommonPlace. PostgreSQL with pgvector, Redis task queues, ONNX Runtime for inference, Modal for GPU workloads.',
    callout: 'One API. Two products. Three task queues.',
    date: '2025 \u2013 Present',
    role: 'Built & Designed',
    roleColor: '--color-teal',
    href: '/projects/index-api',
    visual: 'index-api',
    theme: 'warm-teal',
  },
  {
    slug: 'the-gatehouse',
    title: 'The Gatehouse',
    description:
      'Mixed-income condominiums. Coordinated developers, contractors, city officials, and community stakeholders from planning through grand opening.',
    callout: 'Vacant lot to occupied homes in 30 months.',
    date: 'Jul 2025',
    organization: 'Flint, Michigan',
    role: 'Project Managed',
    roleColor: '--color-terracotta',
    href: '/projects/the-gatehouse',
    visual: 'gatehouse',
    theme: 'warm',
  },
  {
    slug: 'porchfest',
    title: 'Porchfest',
    description:
      'Community music and arts festival. 6th annual. Celebrating local talent and the radical idea that neighborhoods are stages.',
    callout: '40 bands, 12 porches, one neighborhood.',
    date: 'Sep 2025',
    organization: 'Carriage Town, Flint',
    role: 'Organized',
    roleColor: '--color-gold',
    href: '/projects/porchfest',
    visual: 'porchfest',
    theme: 'warm-gold',
  },
];

export const BOTTOM_ROW: ProjectCardData[] = [
  {
    slug: 'compliance-portal',
    title: 'Compliance Portal',
    description:
      'Internal regulatory tracking system. One dashboard replaced a tangle of manual processes.',
    callout: 'Replaced 47 spreadsheets.',
    date: 'Jun 2025',
    organization: 'Genesee County Land Bank Authority',
    role: 'Built & Designed',
    roleColor: '--color-teal',
    href: '/projects/compliance-portal',
    visual: 'compliance',
    theme: 'warm',
  },
  {
    slug: 'youtube-channel',
    title: 'YouTube Channel',
    description:
      'Documentary-style investigations into how design decisions shape human outcomes. Urban planning, policy, architecture.',
    date: '2025 \u2013 Present',
    role: 'Created',
    roleColor: '--color-success',
    href: '/projects/youtube',
    visual: 'youtube',
    theme: 'warm-green',
  },
  {
    slug: 'django-design',
    title: 'Django-Design',
    description:
      'Open-source library making Django as flexible as React for rapid interface composition.',
    date: 'Feb 2026',
    role: 'Built & Designed',
    roleColor: '--color-purple',
    href: '/projects/django-design',
    visual: 'django-design',
    theme: 'warm-purple',
  },
];
