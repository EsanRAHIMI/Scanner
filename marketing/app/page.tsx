/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import {
  MARKETING_ITEMS as items,
  MARKETING_SECTIONS as sections,
  type DashboardItem,
} from '@/lib/config/marketing-os';
import { MarketingPerformanceDashboard } from '@/components/marketing-performance/dashboard';

export default function MarketingHomePage() {
  const [isVisible, setIsVisible] = useState(false);
  const [upcomingPosts, setUpcomingPosts] = useState<any[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    void fetchUpcomingPosts();
  }, []);

  const fetchUpcomingPosts = async () => {
    try {
      setIsLoadingPosts(true);
      const res = await fetch('/api/content-calendar', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const calendarItems = Array.isArray(data.items) ? data.items : [];
        const sorted = calendarItems
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

  const priorityOrder: Record<DashboardItem['priority'], number> = { critical: 0, important: 1, later: 2 };

  const grouped = useMemo(() => {
    return items.reduce<Record<string, DashboardItem[]>>((acc, it) => {
      const k = it.category;
      acc[k] = acc[k] ? [...acc[k], it] : [it];
      return acc;
    }, {});
  }, []);

  return (
    <div
      className={`animate-fade-in space-y-8 sm:space-y-10 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      dir="ltr"
    >
      <section className="dash-hero">
        <p className="dash-eyebrow relative z-10">Marketing OS</p>
        <h1 className="relative z-10 mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          Digital marketing workspace
        </h1>
        <p className="relative z-10 mt-3 max-w-2xl text-sm leading-relaxed text-brand-light-gray/90 md:text-base">
          Strategy, content distribution, and lifecycle operations — aligned with the Lorenzo platform.
        </p>
        <div className="relative z-10 mt-6 flex flex-wrap items-center gap-3">
          <Link href="/calendar" className="btn-primary gap-2 px-5 py-2.5">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3M5 11h14M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
              />
            </svg>
            Open Content Calendar
          </Link>
          <div className="rounded-full border border-brand-white/25 bg-brand-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-brand-white/90">
            V1.4 Stable
          </div>
        </div>
      </section>

      <MarketingPerformanceDashboard />

      <section>
        <p className="dash-eyebrow">Critical workflows</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
          <Link href="/calendar" className="dash-card group p-6 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-burgundy/10 text-brand-burgundy">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3M5 11h14M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z"
                  />
                </svg>
              </div>
              <svg
                className="h-5 w-5 text-brand-medium-gray transition group-hover:translate-x-0.5 group-hover:text-brand-burgundy"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-brand-black">Review content pipeline</h2>
            <p className="mt-2 text-sm text-brand-dark-gray">
              Validate publish readiness and fix channel gaps in the matrix.
            </p>
          </Link>

          <div className="dash-metric">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light-gray">
                <svg className="h-5 w-5 text-brand-dark-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="rounded-full border border-brand-burgundy/20 bg-brand-burgundy/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-burgundy">
                Next up
              </span>
            </div>
            <div className="text-lg font-semibold text-brand-black">Active pipeline</div>
            <div className="mt-4 space-y-3">
              {isLoadingPosts ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-3/4 rounded-lg bg-brand-light-gray" />
                  <div className="h-4 w-1/2 rounded-lg bg-brand-light-gray" />
                  <div className="h-4 w-2/3 rounded-lg bg-brand-light-gray" />
                </div>
              ) : upcomingPosts.length > 0 ? (
                upcomingPosts.map((post, i) => (
                  <div key={post.id || i} className="group flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          post.fields?.Status === 'Published'
                            ? 'bg-green-500'
                            : post.fields?.Status === 'Scheduled'
                              ? 'bg-sky-500'
                              : 'bg-amber-500'
                        }`}
                      />
                      <span className="truncate font-medium text-brand-dark-gray group-hover:text-brand-black">
                        {post.fields?.Title || 'Untitled draft'}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-md bg-brand-light-gray px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-medium-gray">
                      {post.fields?.['Publish Date'] || '—'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-2 text-center text-xs font-medium uppercase tracking-wide text-brand-medium-gray">
                  No active posts
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section>
        <p className="dash-eyebrow">Functional modules</p>
        <div className="mt-4 space-y-6">
          {sections.map((s) => {
            const list = (grouped[s.key] ?? []).slice().sort((a, b) => {
              const ap = priorityOrder[a.priority];
              const bp = priorityOrder[b.priority];
              if (ap !== bp) return ap - bp;
              return a.title.localeCompare(b.title);
            });

            if (!list.length) return null;

            return (
              <div key={s.key} className="dash-panel p-6">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-brand-black">{s.key}</h3>
                    <p className="mt-1 text-sm text-brand-dark-gray">{s.subtitle}</p>
                  </div>
                  <span className="hidden rounded-full bg-brand-light-gray px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-medium-gray sm:inline-flex">
                    {list.length} tool{list.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {list.map((it) => {
                    const ready = it.status === 'ready';
                    const cardBody = (
                      <div
                        className={
                          `rounded-xl border border-brand-medium-gray/30 bg-brand-white p-5 transition-all duration-300 ` +
                          (ready
                            ? 'hover:-translate-y-0.5 hover:border-brand-burgundy/40 hover:shadow-brand-card cursor-pointer'
                            : 'cursor-default opacity-60')
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-brand-black">{it.title}</div>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-dark-gray">
                              {it.description}
                            </p>
                          </div>
                          <span
                            className={
                              ready
                                ? 'shrink-0 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-green-700'
                                : 'shrink-0 rounded-full bg-brand-light-gray px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-medium-gray'
                            }
                          >
                            {ready ? 'Ready' : 'Soon'}
                          </span>
                        </div>
                        <div className="mt-5 flex items-center justify-between border-t border-brand-light-gray pt-4">
                          <span
                            className={
                              `text-[10px] font-semibold uppercase tracking-wide ` +
                              (ready ? 'text-brand-burgundy' : 'text-brand-medium-gray')
                            }
                          >
                            {ready ? 'Launch module' : 'In roadmap'}
                          </span>
                          <svg
                            className={`h-4 w-4 ${ready ? 'text-brand-burgundy' : 'text-brand-light-gray'}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17" />
                          </svg>
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
  );
}
