'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function StrategyPage() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden" dir="ltr">
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>
      </div>

      <div className="relative z-10 min-h-screen flex flex-col">
        <header
          className={
            `border-b border-gray-800 backdrop-blur-lg bg-black/50 transition-all duration-1000 ` +
            (isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4')
          }
        >
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/" className="hover:opacity-80 transition-opacity">
                  <div className="w-10 h-10 bg-amber-600 rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                  </div>
                </Link>
                <div>
                  <h1 className="text-xl font-bold text-white">Strategy & Positioning</h1>
                  <p className="text-gray-400 text-xs text-amber-500/80 uppercase tracking-widest font-semibold">Decide what to say, to whom, and why now</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-6 py-12">
          <div className="max-w-6xl mx-auto space-y-12">
            {/* North Star Section */}
            <section className={`transition-all duration-1000 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="bg-gradient-to-r from-amber-600/10 to-orange-600/10 border border-amber-800/50 rounded-2xl p-8 hover:border-amber-600/50 transition-all duration-500 group">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-900/30 border border-amber-800/50 text-amber-400 text-xs font-bold uppercase tracking-wider">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                      </span>
                      North Star Metric
                    </div>
                    <h2 className="text-4xl font-bold tracking-tight text-white">Active Product Engagement</h2>
                    <p className="text-gray-400 max-w-xl text-lg leading-relaxed">
                      Measuring the percentage of trial users who reach the 'Aha' moment within 7 days by linking their first feed.
                    </p>
                  </div>
                  <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 flex flex-col items-center justify-center min-w-[240px] shadow-2xl group-hover:shadow-amber-600/10 transition-shadow">
                    <div className="text-5xl font-black text-amber-500 mb-2">72.4%</div>
                    <div className="text-gray-500 text-sm font-medium">Growth: +12.3% MoM</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Core Strategy Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Value Proposition', desc: 'Enterprise-grade product intelligence for small teams.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                { title: 'Ideal Customer Profile', desc: 'Direct-to-consumer founders doing $500k-$5M ARR.', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                { title: 'Core Messaging', desc: '"Stop guessing, start scanning. Your competitors are."', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
              ].map((item, idx) => (
                <div 
                  key={item.title}
                  className={`bg-gray-900/30 border border-gray-800 rounded-xl p-8 hover:bg-gray-900/50 transition-all duration-300 group transition-all duration-1000`}
                  style={{ transitionDelay: `${300 + idx * 100}ms` }}
                >
                  <div className="w-12 h-12 bg-amber-600/20 border border-amber-800/30 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed text-sm">{item.desc}</p>
                </div>
              ))}
            </div>

            {/* Quarterly Bets Section */}
            <section className={`bg-gray-900/20 border border-gray-800 rounded-2xl overflow-hidden transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="px-8 py-6 border-b border-gray-800 bg-gray-900/40 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Quarterly Bets (Q2 2026)</h3>
                <span className="text-xs text-amber-500 font-mono tracking-widest px-2 py-1 bg-amber-950/30 border border-amber-900/50 rounded uppercase">Confidence Level</span>
              </div>
              <div className="divide-y divide-gray-800/50">
                {[
                  { bet: 'Viral Social Feed Loops', impact: 'High', conf: 85, status: 'In Progress' },
                  { bet: 'Automated Competitor Tracking', impact: 'Critical', conf: 92, status: 'Active' },
                  { bet: 'Premium Educational Content Series', impact: 'Medium', conf: 60, status: 'Beta' },
                ].map((bet) => (
                  <div key={bet.bet} className="px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full ${bet.status === 'Active' ? 'bg-emerald-500' : bet.status === 'In Progress' ? 'bg-amber-500' : 'bg-blue-500'}`} />
                      <div>
                        <div className="font-bold text-lg text-white">{bet.bet}</div>
                        <div className="text-sm text-gray-500 italic">Impact: {bet.impact}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: `${bet.conf}%` }} />
                      </div>
                      <div className="font-mono text-amber-500 w-12 text-right">{bet.conf}%</div>
                      <span className="px-3 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-bold uppercase tracking-wider">{bet.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
