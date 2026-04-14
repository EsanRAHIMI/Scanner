/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { 
  MARKETING_ITEMS as items, 
  MARKETING_SECTIONS as sections,
  type DashboardItem,
  type SectionDef
} from '@/lib/config/marketing-os';

export default function MarketingHomePage() {
  const [isVisible, setIsVisible] = useState(false);

  const [upcomingPosts, setUpcomingPosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    fetchUpcomingPosts();
  }, []);

  const fetchUpcomingPosts = async () => {
    try {
      setIsLoadingPosts(true);
      const res = await fetch('/api/content-calendar', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const sorted = items
          .filter((it: any) => {
            const s = it.fields?.Status;
            return s === 'Scheduled' || s === 'Published' || s === 'In Progress';
          })
          .sort((a: any, b: any) => {
            const dA = new Date(a.fields?.['Publish Date'] || 0).getTime();
            const dB = new Date(b.fields?.['Publish Date'] || 0).getTime();
            return dA - dB;
          })
          .slice(0, 4);
        setUpcomingPosts(sorted);
      }
    } catch (e) {
      console.error('Failed to fetch posts', e);
    } finally {
      setIsLoadingPosts(false);
    }
  };

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  const priorityOrder: Record<DashboardItem['priority'], number> = { critical: 0, important: 1, later: 2 };

  const grouped = useMemo(() => {
    return items.reduce<Record<string, DashboardItem[]>>((acc, it) => {
      const k = it.category;
      acc[k] = acc[k] ? [...acc[k], it] : [it];
      return acc;
    }, {});
  }, []);



  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden" dir="ltr">
      <div className="fixed inset-0">
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]">
          <div className="h-full w-full bg-grid-pattern" />
        </div>
        <img
          src={`${basePath}/Brand_symbol_1.svg`}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 h-[122vh] w-auto -translate-x-[10vw] -translate-y-[10vh] select-none object-contain opacity-[0.02] dark:opacity-[0.04]"
        />
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header
          className={
            `border-b border-border bg-background/50 backdrop-blur-lg transition-all duration-1000 ` +
            (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4')
          }
        >
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center flex-none shadow-lg shadow-primary/20">
                  <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v18m9-9H3" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-bold text-foreground">Marketing</h1>
                  <p className="text-muted-foreground text-xs font-bold uppercase tracking-widest">Command Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-muted-foreground/50 text-xs font-bold uppercase">Module:</span>
                <Link
                  href="/calendar"
                  className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all"
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
                `mb-12 transition-all duration-1000 delay-150 ` +
                (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')
              }
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-3xl font-bold tracking-tight">Digital Marketing OS</h2>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    A high-performance workspace for strategy, content distribution, and lifecycle operations.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/calendar"
                    className="group relative overflow-hidden bg-primary text-primary-foreground rounded-xl px-5 py-3 transition-all hover:-translate-y-0.5 shadow-lg shadow-primary/10"
                  >
                    <div className="relative z-10 flex items-center gap-3">
                      <div className="w-9 h-9 bg-primary-foreground/10 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M5 11h14M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 text-left">
                        <div className="text-sm font-bold">Open Content Calendar</div>
                        <div className="text-[10px] opacity-70 uppercase tracking-widest">Live Matrix</div>
                      </div>
                    </div>
                  </Link>

                  <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">Roadmap</div>
                    <div className="mt-1 text-sm font-bold">V1.4 Stable</div>
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
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-6 px-1">Critical Workflows</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Link
                  href="/calendar"
                  className="group relative overflow-hidden bg-card border border-border rounded-xl p-6 transition-all hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 md:col-span-2"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3M5 11h14M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
                        </svg>
                      </div>
                      <svg className="w-5 h-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold tracking-tight mb-2">Review Content Pipeline</h4>
                    <p className="text-muted-foreground text-sm">Validate publish readiness and fix channel gaps in the matrix.</p>
                  </div>
                </Link>

                <div className="relative overflow-hidden bg-card border border-border rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-10 h-10 bg-muted rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-[0.1em] bg-primary/10 text-primary border border-primary/20 uppercase">Next Up</span>
                  </div>
                  <div className="text-lg font-bold mb-4 tracking-tight">Active Pipeline</div>
                  <div className="space-y-4">
                    {isLoadingPosts ? (
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-muted rounded-lg w-3/4"></div>
                        <div className="h-4 bg-muted rounded-lg w-1/2"></div>
                        <div className="h-4 bg-muted rounded-lg w-2/3"></div>
                      </div>
                    ) : upcomingPosts.length > 0 ? (
                      upcomingPosts.map((post, i) => (
                        <div key={post.id || i} className="group flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full flex-none ${
                               post.fields?.Status === 'Published' ? 'bg-emerald-500' :
                               post.fields?.Status === 'Scheduled' ? 'bg-blue-500' :
                               'bg-amber-500'
                            }`} />
                            <span className="text-muted-foreground truncate font-medium group-hover:text-foreground transition-colors">{post.fields?.Title || 'Untitled Draft'}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground/60 font-bold tabular-nums flex-none bg-muted px-2 py-0.5 rounded-md">{post.fields?.['Publish Date'] || '---'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-center">
                        <div className="text-[11px] text-muted-foreground/40 font-bold uppercase tracking-wider italic">No Active Posts</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative overflow-hidden bg-muted/40 border border-border rounded-xl p-6 opacity-60">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-muted-foreground/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16M4 12h16M4 17h10" />
                      </svg>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-muted text-muted-foreground/40 uppercase tracking-widest">Coming soon</span>
                  </div>
                  <div className="text-lg font-bold text-muted-foreground/60 tracking-tight">Executive Report</div>
                  <div className="mt-1 text-sm text-muted-foreground/40 font-medium">Weekly KPIs and learnings dashboard.</div>
                </div>
              </div>
            </section>

            <section
              className={
                `transition-all duration-1000 delay-350 ` +
                (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8')
              }
            >
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-6 px-1">Functional Modules</h3>
              <div className="grid grid-cols-1 gap-6">
                {sections.map((s) => {
                  const list = (grouped[s.key] ?? []).slice().sort((a, b) => {
                    const ap = priorityOrder[a.priority];
                    const bp = priorityOrder[b.priority];
                    if (ap !== bp) return ap - bp;
                    return a.title.localeCompare(b.title);
                  });

                  if (!list.length) return null;

                  return (
                    <div key={s.key} className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="min-w-0">
                          <div className="text-foreground font-bold text-lg tracking-tight">{s.key}</div>
                          <div className="mt-1 text-sm text-muted-foreground font-medium">{s.subtitle}</div>
                        </div>
                        <div className="hidden sm:flex items-center gap-2">
                          <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-muted text-muted-foreground/60">{list.length} Tool{list.length === 1 ? '' : 's'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {list.map((it) => {
                          const ready = it.status === 'ready';
                          const cardBody = (
                            <div
                              className={
                                `group relative overflow-hidden bg-background border border-border rounded-xl p-6 transition-all duration-300 ` +
                                (ready ? 'hover:border-primary hover:shadow-lg hover:shadow-primary/5 cursor-pointer' : 'opacity-60 cursor-default grayscale-[0.5]')
                              }
                            >
                              <div className="relative z-10 h-full flex flex-col justify-between">
                                <div className="space-y-4">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-foreground font-bold truncate tracking-tight">{it.title}</div>
                                      <div className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{it.description}</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1.5 flex-none">
                                      <span
                                        className={
                                          ready
                                            ? 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-widest'
                                            : 'px-2 py-0.5 rounded-full text-[9px] font-bold bg-muted text-muted-foreground/40 border border-transparent uppercase tracking-widest'
                                        }
                                      >
                                        {ready ? 'READY' : 'SOON'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-6 flex items-center justify-between pt-4 border-t border-border/50">
                                  <div className={
                                    `text-[10px] font-bold uppercase tracking-widest transition-colors ` +
                                    (ready ? 'text-primary group-hover:underline' : 'text-muted-foreground/30')
                                  }>
                                    {ready ? 'Launch Module' : 'In Roadmap'}
                                  </div>
                                  <svg
                                    className={
                                      `w-4 h-4 transition-all ` +
                                      (ready ? 'text-primary group-hover:translate-x-1' : 'text-muted-foreground/20')
                                    }
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );

                          if (it.href && ready) {
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
          background-image: linear-gradient(currentColor 1px, transparent 1px),
            linear-gradient(90deg, currentColor 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
}
