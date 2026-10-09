export type DashboardItem = {
  title: string;
  description: string;
  href?: string;
  status: 'ready' | 'coming_soon';
  category:
    | 'Strategy'
    | 'Content'
    | 'Channels'
    | 'CRO & Web'
    | 'Lifecycle'
    | 'Automation'
    | 'Analytics';
  priority: 'critical' | 'important' | 'later';
};

export type SectionDef = {
  key: DashboardItem['category'];
  subtitle: string;
  accent: {
    from: string;
    to: string;
    border: string;
    shadow: string;
  };
};

export const MARKETING_ITEMS: DashboardItem[] = [
  {
    title: 'Content Calendar',
    description: 'Plan, schedule, and edit your content pipeline across platforms.',
    href: '/calendar',
    status: 'ready',
    category: 'Content',
    priority: 'critical',
  },
  {
    title: 'Strategy & Positioning',
    description: 'Value prop, ICP, messaging, offers, and quarterly bets.',
    href: '/strategy',
    status: 'ready', // We are making this ready in MVP
    category: 'Strategy',
    priority: 'critical',
  },
  {
    title: 'Campaigns & Launches',
    description: 'Launch plans, budgets, creative, and channel rollouts.',
    status: 'coming_soon',
    category: 'Channels',
    priority: 'important',
  },
  {
    title: 'Asset Library',
    description: 'Templates, brand assets, copy blocks, and approvals.',
    status: 'coming_soon',
    category: 'Content',
    priority: 'important',
  },
  {
    title: 'CRO & Landing Pages',
    description: 'Experiments, forms, and on-site personalization.',
    status: 'coming_soon',
    category: 'CRO & Web',
    priority: 'important',
  },
  {
    title: 'Lifecycle (CRM)',
    description: 'Email/SMS journeys, retention, winback, and segmentation.',
    status: 'coming_soon',
    category: 'Lifecycle',
    priority: 'important',
  },
  {
    title: 'Automation & Integrations',
    description: 'Workflows, webhooks, and quality gates for marketing ops.',
    status: 'coming_soon',
    category: 'Automation',
    priority: 'later',
  },
  {
    title: 'Analytics & Attribution',
    description: 'KPIs, cohorts, attribution, and reporting cadence.',
    status: 'coming_soon',
    category: 'Analytics',
    priority: 'critical',
  },
];

export const MARKETING_SECTIONS: SectionDef[] = [
  {
    key: 'Strategy',
    subtitle: 'Decide what to say, to whom, and why now.',
    accent: {
      from: 'from-amber-600/20',
      to: 'to-orange-600/20',
      border: 'border-amber-800/50',
      shadow: 'hover:shadow-amber-600/20',
    },
  },
  {
    key: 'Content',
    subtitle: 'Build a scalable content engine and governance.',
    accent: {
      from: 'from-emerald-600/20',
      to: 'to-teal-600/20',
      border: 'border-emerald-800/50',
      shadow: 'hover:shadow-emerald-600/20',
    },
  },
  {
    key: 'Channels',
    subtitle: 'Distribute and amplify through paid + organic.',
    accent: {
      from: 'from-pink-600/20',
      to: 'to-rose-600/20',
      border: 'border-pink-800/50',
      shadow: 'hover:shadow-pink-600/20',
    },
  },
  {
    key: 'CRO & Web',
    subtitle: 'Turn attention into action with experiments.',
    accent: {
      from: 'from-purple-600/20',
      to: 'to-indigo-600/20',
      border: 'border-purple-800/50',
      shadow: 'hover:shadow-purple-600/20',
    },
  },
  {
    key: 'Lifecycle',
    subtitle: 'Retention, nurture, and customer journeys.',
    accent: {
      from: 'from-sky-600/20',
      to: 'to-cyan-600/20',
      border: 'border-sky-800/50',
      shadow: 'hover:shadow-sky-600/20',
    },
  },
  {
    key: 'Automation',
    subtitle: 'Repeatable workflows and quality gates.',
    accent: {
      from: 'from-gray-600/20',
      to: 'to-zinc-600/20',
      border: 'border-gray-800/50',
      shadow: 'hover:shadow-white/10',
    },
  },
  {
    key: 'Analytics',
    subtitle: 'Measure impact and decide what to do next.',
    accent: {
      from: 'from-blue-600/20',
      to: 'to-violet-600/20',
      border: 'border-blue-800/50',
      shadow: 'hover:shadow-blue-600/20',
    },
  },
];
