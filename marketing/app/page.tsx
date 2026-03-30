/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type DashboardItem = {
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

type SectionDef = {
  key: DashboardItem['category'];
  subtitle: string;
  accent: {
    from: string;
    to: string;
    border: string;
    shadow: string;
  };
};

export default function MarketingHomePage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  const items: DashboardItem[] = [
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
      status: 'coming_soon',
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

  const sections: SectionDef[] = [
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

  const priorityOrder: Record<DashboardItem['priority'], number> = { critical: 0, important: 1, later: 2 };

  const grouped = useMemo(() => {
    return items.reduce<Record<string, DashboardItem[]>>((acc, it) => {
      const k = it.category;
      acc[k] = acc[k] ? [...acc[k], it] : [it];
      return acc;
    }, {});
  }, [items]);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden" dir="ltr">
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-grid-pattern" />
        </div>
        <img
          src={`${basePath}/Brand_symbol_1.svg`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.06]"
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header
          className={
            `border-b border-gray-800 backdrop-blur-lg bg-black/50 transition-all duration-1000 ` +
            (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4')
          }
        >
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg flex items-center justify-center flex-none">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18m9-9H3" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold text-white">Marketing</h1>
                  <p className="text-gray-400 text-sm">Command Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-gray-500 text-sm">Module:</span>
                <Link
                  href="/calendar"
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-800 hover:border-emerald-600 transition-colors"
                >
                  Content Calendar
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-6 py-12">
          <div className="max-w-7xl mx-auto">
            <section
              className={
                `mb-10 transition-all duration-1000 delay-150 ` +
                (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')
              }
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-3xl font-semibold tracking-tight">Digital Marketing OS (2026)</h2>
                  <p className="mt-2 max-w-2xl text-sm text-gray-400">
                    A structured workspace for planning, execution, experimentation, and measurement.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/calendar"
                    className="group relative overflow-hidden bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-800/50 rounded-xl px-5 py-3 hover:border-emerald-600 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-600/20"
                  >
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M5 11h14M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-semibold text-white">Open calendar</div>
                        <div className="text-xs text-gray-400">Review this week and adjust schedule</div>
                      </div>
                      <svg
                        className="w-5 h-5 text-emerald-300 group-hover:translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>

                  <div className="rounded-xl border border-gray-800 bg-gray-900/30 px-4 py-3">
                    <div className="text-xs text-gray-400">Roadmap</div>
                    <div className="mt-1 text-sm font-semibold text-white">Modules are staged</div>
                  </div>
                </div>
              </div>
            </section>

            <section
              className={
                `mb-12 transition-all duration-1000 delay-250 ` +
                (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')
              }
            >
              <h3 className="text-xl font-semibold text-gray-300 mb-6">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link
                  href="/calendar"
                  className="group relative overflow-hidden bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-800/50 rounded-xl p-6 hover:border-emerald-600 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-600/20 md:col-span-2"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M5 11h14M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-emerald-300 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">Review content pipeline</h4>
                    <p className="text-gray-400 text-sm">Validate publish readiness and fix gaps</p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>

                <div className="relative overflow-hidden bg-gradient-to-r from-gray-700/10 to-zinc-700/10 border border-gray-800 rounded-xl p-6 opacity-80">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h8m-8 4h5M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                      </svg>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-900/50 text-gray-300 border border-gray-800">Coming soon</span>
                  </div>
                  <div className="text-lg font-semibold text-white">Campaign brief</div>
                  <div className="mt-1 text-sm text-gray-400">Standardize launches and promos</div>
                </div>

                <div className="relative overflow-hidden bg-gradient-to-r from-gray-700/10 to-zinc-700/10 border border-gray-800 rounded-xl p-6 opacity-80">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h16M4 17h10" />
                      </svg>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-900/50 text-gray-300 border border-gray-800">Coming soon</span>
                  </div>
                  <div className="text-lg font-semibold text-white">Executive report</div>
                  <div className="mt-1 text-sm text-gray-400">Weekly KPIs and learnings</div>
                </div>
              </div>
            </section>

            <section
              className={
                `transition-all duration-1000 delay-350 ` +
                (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')
              }
            >
              <h3 className="text-xl font-semibold text-gray-300 mb-6">Modules</h3>
              <div className="grid grid-cols-1 gap-5">
                {sections.map((s) => {
                  const list = (grouped[s.key] ?? []).slice().sort((a, b) => {
                    const ap = priorityOrder[a.priority];
                    const bp = priorityOrder[b.priority];
                    if (ap !== bp) return ap - bp;
                    return a.title.localeCompare(b.title);
                  });

                  if (!list.length) return null;

                  return (
                    <div key={s.key} className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-white font-semibold">{s.key}</div>
                          <div className="mt-1 text-sm text-gray-400">{s.subtitle}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-900/50 text-gray-300 border border-gray-800">{list.length} module(s)</span>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {list.map((it) => {
                          const ready = it.status === 'ready';
                          const cardBody = (
                            <div
                              className={
                                `group relative overflow-hidden bg-gradient-to-r ${s.accent.from} ${s.accent.to} border ${s.accent.border} rounded-xl p-6 ` +
                                `hover:border-gray-600 transition-all duration-300 hover:shadow-lg ${s.accent.shadow}` +
                                (ready ? '' : ' opacity-85')
                              }
                            >
                              <div className="relative z-10">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-white font-semibold truncate">{it.title}</div>
                                    <div className="mt-1 text-sm text-gray-400">{it.description}</div>
                                  </div>
                                  <div className="flex flex-col items-end gap-2 flex-none">
                                    <span
                                      className={
                                        ready
                                          ? 'px-2 py-1 rounded-full text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-800'
                                          : 'px-2 py-1 rounded-full text-xs font-semibold bg-gray-900/50 text-gray-300 border border-gray-800'
                                      }
                                    >
                                      {ready ? 'READY' : 'SOON'}
                                    </span>
                                    <span
                                      className={
                                        it.priority === 'critical'
                                          ? 'px-2 py-1 rounded-full text-xs font-semibold bg-amber-900/40 text-amber-200 border border-amber-800'
                                          : it.priority === 'important'
                                            ? 'px-2 py-1 rounded-full text-xs font-semibold bg-blue-900/40 text-blue-200 border border-blue-800'
                                            : 'px-2 py-1 rounded-full text-xs font-semibold bg-gray-900/50 text-gray-300 border border-gray-800'
                                      }
                                    >
                                      {it.priority === 'critical' ? 'CRITICAL' : it.priority === 'important' ? 'IMPORTANT' : 'LATER'}
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-5 flex items-center justify-between">
                                  <div className="text-xs text-gray-500">{ready ? 'Open module' : 'Planned module'}</div>
                                  <svg
                                    className={
                                      `w-5 h-5 text-gray-400 transition-transform ` +
                                      (ready ? 'group-hover:translate-x-1' : '')
                                    }
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
                                  </svg>
                                </div>
                              </div>
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-r from-white/5 to-transparent" />
                            </div>
                          );

                          if (it.href) {
                            return (
                              <Link key={it.title} href={it.href} className="block">
                                {cardBody}
                              </Link>
                            );
                          }

                          return (
                            <div key={it.title} className="block">
                              {cardBody}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </main>
      </div>

      <style jsx>{`
        .bg-grid-pattern {
          background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
}
