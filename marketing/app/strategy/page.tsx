'use client';

import { useEffect, useState } from 'react';

export default function StrategyPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div
      className={`animate-fade-in space-y-8 sm:space-y-10 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      dir="ltr"
    >
      <section>
        <p className="dash-eyebrow">Strategy & positioning</p>
        <h1 className="dash-title">Decide what to say, to whom, and why now</h1>
        <p className="mt-3 max-w-2xl text-sm text-brand-dark-gray md:text-base">
          North star metrics, core messaging, and quarterly bets — aligned with Lorenzo marketing operations.
        </p>
      </section>

      <section className="dash-hero">
        <div className="relative z-10 flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-white/25 bg-brand-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-white">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-white opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-white" />
              </span>
              North star metric
            </div>
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Active product engagement</h2>
            <p className="max-w-xl text-sm leading-relaxed text-brand-light-gray/90 md:text-base">
              Measuring the percentage of trial users who reach the &apos;Aha&apos; moment within 7 days by linking
              their first feed.
            </p>
          </div>
          <div className="flex min-w-[200px] flex-col items-center justify-center rounded-2xl border border-brand-white/20 bg-brand-black/20 p-8 backdrop-blur-sm">
            <div className="mb-2 text-4xl font-bold tabular-nums md:text-5xl">72.4%</div>
            <div className="text-sm font-medium text-brand-light-gray/80">Growth: +12.3% MoM</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        {[
          {
            title: 'Value proposition',
            desc: 'Enterprise-grade product intelligence for small teams.',
            icon: 'M13 10V3L4 14h7v7l9-11h-7z',
          },
          {
            title: 'Ideal customer profile',
            desc: 'Direct-to-consumer founders doing $500k–$5M ARR.',
            icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
          },
          {
            title: 'Core messaging',
            desc: '"Stop guessing, start scanning. Your competitors are."',
            icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
          },
        ].map((item) => (
          <div key={item.title} className="dash-card p-6">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-burgundy/10 text-brand-burgundy">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-brand-black">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-brand-dark-gray">{item.desc}</p>
          </div>
        ))}
      </div>

      <section className="dash-panel overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-brand-light-gray bg-brand-white/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold text-brand-black">Quarterly bets (Q2 2026)</h3>
          <span className="inline-flex w-fit rounded-full border border-brand-burgundy/20 bg-brand-burgundy/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-burgundy">
            Confidence level
          </span>
        </div>
        <div className="divide-y divide-brand-light-gray">
          {[
            { bet: 'Viral social feed loops', impact: 'High', conf: 85, status: 'In Progress' },
            { bet: 'Automated competitor tracking', impact: 'Critical', conf: 92, status: 'Active' },
            { bet: 'Premium educational content series', impact: 'Medium', conf: 60, status: 'Beta' },
          ].map((bet) => (
            <div
              key={bet.bet}
              className="flex flex-col justify-between gap-4 px-6 py-5 transition-colors hover:bg-brand-light-gray/30 md:flex-row md:items-center"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    bet.status === 'Active'
                      ? 'bg-green-500'
                      : bet.status === 'In Progress'
                        ? 'bg-amber-500'
                        : 'bg-sky-500'
                  }`}
                />
                <div>
                  <div className="font-semibold text-brand-black">{bet.bet}</div>
                  <div className="text-sm italic text-brand-medium-gray">Impact: {bet.impact}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="h-2 w-40 overflow-hidden rounded-full bg-brand-light-gray sm:w-48">
                  <div className="h-full rounded-full bg-brand-burgundy" style={{ width: `${bet.conf}%` }} />
                </div>
                <div className="w-10 text-right font-mono text-sm font-semibold tabular-nums text-brand-burgundy">
                  {bet.conf}%
                </div>
                <span className="rounded-full bg-brand-light-gray px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-dark-gray">
                  {bet.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
