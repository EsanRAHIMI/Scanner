'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { AppAccountMenu } from '@/components/scanner-account-menu';
import { PlatformOverview } from '@/components/platform-overview';
import type { AppUrls } from '@/lib/app-urls';
import { safelyVoid } from '@/lib/client-log';
import { HUB_LOCAL_GIT_PATH, HUB_TRAINER_API_PREFIX } from '@/lib/hub-paths';
import {
  BACKEND_SERVICE_NAMES,
  FRONTEND_SERVICE_NAMES,
  type ServiceHealthSnapshot,
} from '@/lib/service-health';

interface ServiceStatus {
  name: string;
  checkUrl: string;
  openUrl: string;
  status: 'loading' | 'online' | 'offline' | 'degraded';
  responseTime?: number;
  error?: string;
  detail?: string;
}

function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (!href || href === '#') {
    return <div className={className}>{children}</div>;
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}

function entryToStatus(entry: ServiceHealthSnapshot['frontend'][string]): ServiceStatus {
  return {
    name: entry.name,
    checkUrl: entry.checkUrl,
    openUrl: entry.openUrl,
    status: entry.status,
    responseTime: entry.responseTime,
    error: entry.error,
    detail: entry.detail,
  };
}

function loadingFrontendStatuses(urls: AppUrls): Record<string, ServiceStatus> {
  return {
    'Products App': {
      name: 'Products App',
      checkUrl: urls.products,
      openUrl: urls.products,
      status: 'loading',
    },
    'Scanner UI': {
      name: 'Scanner UI',
      checkUrl: urls.scanner,
      openUrl: urls.scanner,
      status: 'loading',
    },
    'Trainer Web': {
      name: 'Trainer Web',
      checkUrl: urls.trainer,
      openUrl: urls.trainer,
      status: 'loading',
    },
    'Marketing App': {
      name: 'Marketing App',
      checkUrl: urls.marketing,
      openUrl: urls.marketing,
      status: 'loading',
    },
  };
}

function loadingBackendStatuses(urls: AppUrls): Record<string, ServiceStatus> {
  return {
    'Inference API': {
      name: 'Inference API',
      checkUrl: urls.backendHealth,
      openUrl: urls.backendHealth,
      status: 'loading',
    },
    'Trainer API': {
      name: 'Trainer API',
      checkUrl: urls.trainerHealth,
      openUrl: urls.trainerHealth,
      status: 'loading',
    },
    MongoDB: {
      name: 'MongoDB',
      checkUrl: urls.mongodbHealth,
      openUrl: urls.mongodbHealth,
      status: 'loading',
    },
  };
}

type DashboardHomeProps = {
  urls: AppUrls;
  isLocal: boolean;
};

export function DashboardHome({ urls, isLocal }: DashboardHomeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [frontendStatuses, setFrontendStatuses] = useState<Record<string, ServiceStatus>>(() =>
    loadingFrontendStatuses(urls),
  );
  const [backendStatuses, setBackendStatuses] = useState<Record<string, ServiceStatus>>(() =>
    loadingBackendStatuses(urls),
  );
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<{ email?: string; username?: string; is_admin?: boolean; role?: string | null } | null>(null);
  const [gitMessage, setGitMessage] = useState('');
  const [gitBusy, setGitBusy] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [gitOutput, setGitOutput] = useState<string>('');
  const [gitStatus, setGitStatus] = useState<{
    repoRoot: string;
    branch: string;
    status: string;
    recentCommits: string;
  } | null>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const href = (url: string | undefined) => (url ? url : '#');

  const trainerUrl = urls.trainer;
  const productsUrl = urls.products;
  const marketingUrl = urls.marketing;
  const scannerUrl = urls.scanner;
  const statusUrl = urls.status;
  const backendHealthUrl = urls.backendHealth;
  const trainerHealthUrl = urls.trainerHealth;
  const mongodbHealthUrl = urls.mongodbHealth;
  const trainerLoginUrl = urls.trainerLogin;
  const canManageLocalGit = isLocal && !!authUser && (Boolean(authUser.is_admin) || (authUser.role || '').toLowerCase() === 'admin');
  const gitStatusLines = useMemo(
    () => (gitStatus?.status ? gitStatus.status.split('\n').map((x) => x.trim()).filter(Boolean) : []),
    [gitStatus?.status],
  );
  const gitWorkingTreeMetrics = useMemo(() => {
    let modified = 0;
    let added = 0;
    let deleted = 0;
    let untracked = 0;
    for (const line of gitStatusLines) {
      const code = line.slice(0, 2);
      if (code.includes('M')) modified += 1;
      if (code.includes('A')) added += 1;
      if (code.includes('D')) deleted += 1;
      if (code === '??') untracked += 1;
    }
    return { modified, added, deleted, untracked, total: gitStatusLines.length };
  }, [gitStatusLines]);
  const isGitClean = gitStatus?.status === '(clean)' || gitWorkingTreeMetrics.total === 0;

  const refreshAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(`${HUB_TRAINER_API_PREFIX}/auth/me`, { cache: 'no-store' });
      if (res.status === 401) { setAuthUser(null); return; }
      const text = await res.text();
      if (!res.ok) throw new Error(text || `Auth failed (${res.status})`);
      setAuthUser(JSON.parse(text) as typeof authUser);
    } catch (error) {
      setAuthUser(null);
      setAuthError(error instanceof Error ? error.message : 'خطا در احراز هویت');
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (!isLocal) return;
    let cancelled = false;
    const loadAuth = async () => {
      setAuthLoading(true);
      setAuthError(null);
      try {
        const res = await fetch(`${HUB_TRAINER_API_PREFIX}/auth/me`, { cache: 'no-store' });
        if (res.status === 401) {
          if (!cancelled) setAuthUser(null);
          return;
        }
        const text = await res.text();
        if (!res.ok) throw new Error(text || `Auth failed (${res.status})`);
        const data = JSON.parse(text) as { email?: string; username?: string; is_admin?: boolean; role?: string | null };
        if (!cancelled) setAuthUser(data);
      } catch (error) {
        if (!cancelled) {
          setAuthUser(null);
          setAuthError(error instanceof Error ? error.message : 'خطا در احراز هویت');
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };
    void loadAuth();
    return () => {
      cancelled = true;
    };
  }, [isLocal]);

  useEffect(() => {
    let cancelled = false;

    const applySnapshot = (snapshot: ServiceHealthSnapshot) => {
      const nextFrontend: Record<string, ServiceStatus> = {};
      for (const entry of Object.values(snapshot.frontend)) {
        nextFrontend[entry.name] = entryToStatus(entry);
      }

      const nextBackend: Record<string, ServiceStatus> = {};
      for (const entry of Object.values(snapshot.backend)) {
        nextBackend[entry.name] = entryToStatus(entry);
      }

      if (!cancelled) {
        setFrontendStatuses(nextFrontend);
        setBackendStatuses(nextBackend);
      }
    };

    const refreshHealth = async () => {
      try {
        const res = await fetch('/hub/service-health', { cache: 'no-store' });
        if (!res.ok) throw new Error(`health ${res.status}`);
        const snapshot = (await res.json()) as ServiceHealthSnapshot;
        applySnapshot(snapshot);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Health check failed';
        setFrontendStatuses((prev) => {
          const next = { ...prev };
          for (const name of FRONTEND_SERVICE_NAMES) {
            next[name] = {
              ...(next[name] || { name, checkUrl: '', openUrl: '' }),
              status: 'offline',
              error: message,
            };
          }
          return next;
        });
        setBackendStatuses((prev) => {
          const next = { ...prev };
          for (const name of BACKEND_SERVICE_NAMES) {
            next[name] = {
              ...(next[name] || { name, checkUrl: '', openUrl: '' }),
              status: 'offline',
              error: message,
            };
          }
          return next;
        });
      }
    };

    setFrontendStatuses(loadingFrontendStatuses(urls));
    setBackendStatuses(loadingBackendStatuses(urls));

    safelyVoid('home_service_health_initial', refreshHealth());
    const interval = setInterval(() => {
      safelyVoid('home_service_health_poll', refreshHealth());
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [urls]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      case 'loading': return 'bg-yellow-500 animate-pulse';
      default: return 'bg-gray-500';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'degraded': return 'text-yellow-400';
      case 'offline': return 'text-red-400';
      case 'loading': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getServiceStatusLabel = (serviceName: string, status?: ServiceStatus['status']) => {
    if (!status || status === 'loading') return 'Checking...';
    if (status === 'degraded') return 'Degraded';
    if (status === 'online') return serviceName === 'MongoDB' ? 'Connected' : 'Online';
    return serviceName === 'MongoDB' ? 'Disconnected' : 'Offline';
  };

  const frontendHealthValues = Object.values(frontendStatuses);
  const backendHealthValues = Object.values(backendStatuses);
  const frontendHealthy = frontendHealthValues.length > 0 && frontendHealthValues.every(
    (service) => service.status === 'online',
  );
  const frontendOffline = frontendHealthValues.some((service) => service.status === 'offline');
  const backendHealthy = backendHealthValues.length > 0 && backendHealthValues.every(
    (service) => service.status === 'online' || service.status === 'degraded',
  );
  const backendOffline = backendHealthValues.some((service) => service.status === 'offline');
  const backendDegraded = backendHealthValues.some((service) => service.status === 'degraded');

  const callGitApi = async (method: 'GET' | 'POST', body?: Record<string, unknown>) => {
    const res = await fetch(HUB_LOCAL_GIT_PATH, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error((json?.error as string) || 'request_failed');
    }
    return json;
  };

  const refreshGitStatus = async () => {
    if (!canManageLocalGit) return;
    setGitError(null);
    setGitBusy(true);
    try {
      const json = await callGitApi('GET');
      setGitStatus({
        repoRoot: json.repoRoot as string,
        branch: json.branch as string,
        status: json.status as string,
        recentCommits: json.recentCommits as string,
      });
      setGitOutput('');
    } catch (error) {
      setGitStatus(null);
      setGitError(error instanceof Error ? error.message : 'خطا');
    } finally {
      setGitBusy(false);
    }
  };

  const runCommit = async () => {
    if (!canManageLocalGit) return;
    if (!gitMessage.trim()) {
      setGitError('پیام کامیت خالی است.');
      return;
    }
    setGitError(null);
    setGitBusy(true);
    try {
      const json = await callGitApi('POST', {
        action: 'commit',
        message: gitMessage.trim(),
        stageAll: true,
      });
      setGitOutput((json.commitOutput as string) || '');
      setGitStatus({
        repoRoot: json.repoRoot as string,
        branch: json.branch as string,
        status: json.status as string,
        recentCommits: json.recentCommits as string,
      });
      setGitMessage('');
    } catch (error) {
      setGitError(error instanceof Error ? error.message : 'خطا');
    } finally {
      setGitBusy(false);
    }
  };

  const runPush = async () => {
    if (!canManageLocalGit) return;
    setGitError(null);
    setGitBusy(true);
    try {
      const json = await callGitApi('POST', { action: 'push' });
      setGitOutput((json.pushOutput as string) || '');
      setGitStatus({
        repoRoot: json.repoRoot as string,
        branch: json.branch as string,
        status: json.status as string,
        recentCommits: json.recentCommits as string,
      });
    } catch (error) {
      setGitError(error instanceof Error ? error.message : 'خطا');
    } finally {
      setGitBusy(false);
    }
  };

  const copyGitOutput = async () => {
    if (!gitOutput.trim()) return;
    try {
      await navigator.clipboard.writeText(gitOutput);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden" dir="ltr">
      {/* Background Grid */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900">
        <div className="absolute inset-0 opacity-20">
          <div className="h-full w-full bg-grid-pattern"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className={`relative z-[200] overflow-visible border-b border-gray-800 backdrop-blur-lg bg-black/50 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                  <p className="text-gray-400 text-sm">Services hub</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-500 text-sm">Frontends:</span>
                  <div className="flex items-center space-x-2">
                    {FRONTEND_SERVICE_NAMES.map((name) => {
                      const service = frontendStatuses[name];
                      return (
                      <div key={name} className="flex items-center space-x-1" title={name}>
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(service?.status || 'loading')}`}></div>
                        <span className={`text-xs ${getStatusTextColor(service?.status || 'loading')}`}>
                          {service?.status === 'loading' ? '...' :
                           service?.status === 'online' ? '↑' : '↓'}
                        </span>
                      </div>
                    )})}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Environment:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${isLocal ? 'bg-orange-900/50 text-orange-400 border border-orange-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
                    {isLocal ? 'LOCAL' : 'PRODUCTION'}
                  </span>
                  <AppAccountMenu
                    app="frontend"
                    surface="dark"
                    className="shrink-0"
                    onAuthChange={() => void refreshAuth()}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Dashboard */}
        <main className="relative z-0 flex-1 container mx-auto px-6 py-12">
          <div className="max-w-7xl mx-auto">
            
            {/* Quick Actions — frontend apps */}
            <section className={`mb-12 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-xl font-semibold text-gray-300 mb-2">Quick Actions</h2>
              <p className="text-sm text-gray-500 mb-6">Frontend apps — status and open in a new tab</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <ExternalLink
                  href={href(productsUrl)}
                  className="group relative overflow-hidden bg-gradient-to-r from-pink-600/20 to-rose-600/20 border border-pink-800/50 rounded-xl p-6 hover:border-pink-600 transition-all duration-300 hover:shadow-lg hover:shadow-pink-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-pink-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(frontendStatuses['Products App']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-pink-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Products Manager</h3>
                    <p className="text-gray-400 text-sm">Browse and manage the product catalog</p>
                    {frontendStatuses['Products App']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {frontendStatuses['Products App'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-600/10 to-rose-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </ExternalLink>

                <ExternalLink
                  href={href(scannerUrl)}
                  className="group relative overflow-hidden bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border border-purple-800/50 rounded-xl p-6 hover:border-purple-600 transition-all duration-300 hover:shadow-lg hover:shadow-purple-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(frontendStatuses['Scanner UI']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Scanner UI</h3>
                    <p className="text-gray-400 text-sm">Live camera scanning with YOLO detection</p>
                    {frontendStatuses['Scanner UI']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {frontendStatuses['Scanner UI'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </ExternalLink>

                <ExternalLink
                  href={href(trainerUrl)}
                  className="group relative overflow-hidden bg-gradient-to-r from-green-600/20 to-teal-600/20 border border-green-800/50 rounded-xl p-6 hover:border-green-600 transition-all duration-300 hover:shadow-lg hover:shadow-green-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(frontendStatuses['Trainer Web']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-green-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Trainer Dashboard</h3>
                    <p className="text-gray-400 text-sm">Label, train, and publish models</p>
                    {frontendStatuses['Trainer Web']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {frontendStatuses['Trainer Web'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-teal-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </ExternalLink>

                <ExternalLink
                  href={href(marketingUrl)}
                  className="group relative overflow-hidden bg-gradient-to-r from-cyan-600/20 to-sky-600/20 border border-cyan-800/50 rounded-xl p-6 hover:border-cyan-600 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-600/20"
                >
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 bg-cyan-600 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          ></path>
                        </svg>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(frontendStatuses['Marketing App']?.status || 'loading')}`}></div>
                        <svg className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Digital Marketing OS</h3>
                    <p className="text-gray-400 text-sm">Marketing calendar and campaign planning</p>
                    {frontendStatuses['Marketing App']?.responseTime && (
                      <p className="text-gray-500 text-xs mt-2">
                        Response: {frontendStatuses['Marketing App'].responseTime}ms
                      </p>
                    )}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/10 to-sky-600/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </ExternalLink>
              </div>
            </section>

            {/* Service Status Monitor — backend APIs */}
            <section className={`mb-12 transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h2 className="text-xl font-semibold text-gray-300 mb-2">Service Status Monitor</h2>
              <p className="text-sm text-gray-500 mb-6">Backend health endpoints — click to view JSON in a new tab</p>
              <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <ExternalLink
                    href={href(backendHealthUrl)}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(backendStatuses['Inference API']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">Inference API</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(backendStatuses['Inference API']?.status || 'loading')}`}>
                          {getServiceStatusLabel('Inference API', backendStatuses['Inference API']?.status)}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs truncate mb-2">{backendHealthUrl}</p>
                    {backendStatuses['Inference API']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {backendStatuses['Inference API'].responseTime}ms
                      </div>
                    )}
                    {backendStatuses['Inference API']?.detail && (
                      <div className="text-yellow-400 text-xs mt-1">
                        {backendStatuses['Inference API'].detail}
                      </div>
                    )}
                    {backendStatuses['Inference API']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {backendStatuses['Inference API'].error}
                      </div>
                    )}
                  </ExternalLink>

                  <ExternalLink
                    href={href(trainerHealthUrl)}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(backendStatuses['Trainer API']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">Trainer API</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(backendStatuses['Trainer API']?.status || 'loading')}`}>
                          {getServiceStatusLabel('Trainer API', backendStatuses['Trainer API']?.status)}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs truncate mb-2">{trainerHealthUrl}</p>
                    {backendStatuses['Trainer API']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {backendStatuses['Trainer API'].responseTime}ms
                      </div>
                    )}
                    {backendStatuses['Trainer API']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {backendStatuses['Trainer API'].error}
                      </div>
                    )}
                  </ExternalLink>

                  <ExternalLink
                    href={href(mongodbHealthUrl)}
                    className="group bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-all duration-300 cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(backendStatuses['MongoDB']?.status || 'loading')}`}></div>
                        <h4 className="text-white font-medium text-sm">MongoDB</h4>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs ${getStatusTextColor(backendStatuses['MongoDB']?.status || 'loading')}`}>
                          {getServiceStatusLabel('MongoDB', backendStatuses['MongoDB']?.status)}
                        </span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                        </svg>
                      </div>
                    </div>
                    <p className="text-gray-600 text-xs truncate mb-2">{mongodbHealthUrl}</p>
                    {backendStatuses['MongoDB']?.responseTime && (
                      <div className="text-gray-500 text-xs">
                        Response: {backendStatuses['MongoDB'].responseTime}ms
                      </div>
                    )}
                    {backendStatuses['MongoDB']?.error && (
                      <div className="text-red-400 text-xs mt-1">
                        {backendStatuses['MongoDB'].error}
                      </div>
                    )}
                  </ExternalLink>
                </div>

                <ExternalLink
                  href={href(statusUrl)}
                  className="group mt-4 pt-4 border-t border-gray-800 block cursor-pointer hover:bg-gray-900/20 -mx-2 px-2 py-1 rounded transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(
                        backendOffline ? 'offline' :
                        backendDegraded ? 'degraded' :
                        backendHealthy ? 'online' : 'loading'
                      )}`}></div>
                      <span className="text-gray-400 text-sm group-hover:text-white transition-colors">
                        Backend overall: {
                          backendOffline ? 'Some APIs Down' :
                          backendDegraded ? 'Degraded Performance' :
                          backendHealthy ? 'All Backend APIs Operational' :
                          'Checking backend...'
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors">
                        Detailed status page · auto-refresh 30s
                      </div>
                      <svg className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 17L17 7M17 7H7M17 7V17"></path>
                      </svg>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    Frontends: {frontendOffline ? 'some down' : frontendHealthy ? 'all online' : 'checking...'}
                  </div>
                </ExternalLink>
              </div>
            </section>

            <PlatformOverview visible={isVisible} />

            {isLocal && (
              <section className={`mt-12 transition-all duration-1000 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.35em] text-white/35">Developer Tools</p>
                    <h2 className="mt-2 text-xl font-semibold text-gray-200">Local Git</h2>
                    <p className="mt-1 text-sm text-gray-500">Admin-only commit and push from this machine.</p>
                  </div>
                  {gitStatus ? (
                    <div className="flex items-center gap-3 text-xs text-white/45">
                      <span className="font-mono text-white/70">{gitStatus.branch}</span>
                      <span className={`rounded-full border px-2.5 py-1 ${isGitClean ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
                        {isGitClean ? 'Clean' : `${gitWorkingTreeMetrics.total} changes`}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm">
                  <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {authLoading ? (
                        <p className="text-sm text-white/45">Checking auth…</p>
                      ) : authUser ? (
                        <p className="text-sm text-white/70">
                          <span className="text-white">{authUser.username || authUser.email || 'user'}</span>
                          <span className="text-white/30"> · </span>
                          <span className="uppercase tracking-wider text-[11px] text-white/45">
                            {authUser.role || (authUser.is_admin ? 'admin' : 'user')}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-white/45">Sign in as admin to use git controls.</p>
                      )}
                      {authError ? <p className="mt-1 text-xs text-red-400">{authError}</p> : null}
                    </div>

                    {!canManageLocalGit ? (
                      <Link
                        href={href(trainerLoginUrl)}
                        className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08]"
                      >
                        Sign in via Trainer
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void refreshGitStatus()}
                        disabled={gitBusy}
                        className="inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/75 transition-colors hover:border-white/20 hover:bg-white/[0.08] disabled:opacity-40"
                      >
                        {gitBusy ? 'Refreshing…' : 'Refresh status'}
                      </button>
                    )}
                  </div>

                  {gitStatus ? (
                    <div className="grid grid-cols-2 gap-px bg-white/10 md:grid-cols-4">
                      {[
                        { label: 'Modified', value: gitWorkingTreeMetrics.modified },
                        { label: 'Added', value: gitWorkingTreeMetrics.added },
                        { label: 'Deleted', value: gitWorkingTreeMetrics.deleted },
                        { label: 'Untracked', value: gitWorkingTreeMetrics.untracked },
                      ].map((item) => (
                        <div key={item.label} className="bg-black/20 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">{item.label}</p>
                          <p className="mt-1 text-lg font-light tabular-nums text-white">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {canManageLocalGit ? (
                    <div className="space-y-4 border-t border-white/10 px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: 'chore', message: 'chore: update local changes' },
                          { label: 'fix', message: 'fix: resolve issue in local workflow' },
                          { label: 'feat', message: 'feat: implement requested improvement' },
                        ].map((template) => (
                          <button
                            key={template.label}
                            type="button"
                            onClick={() => setGitMessage(template.message)}
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/55 transition-colors hover:border-white/20 hover:text-white/80"
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-col gap-3 lg:flex-row">
                        <input
                          type="text"
                          value={gitMessage}
                          onChange={(e) => setGitMessage(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                              e.preventDefault();
                              void runCommit();
                            }
                          }}
                          placeholder="Commit message"
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-white/20 focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void runCommit()}
                            disabled={gitBusy || !gitMessage.trim()}
                            className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.1] disabled:opacity-40"
                          >
                            Commit
                          </button>
                          <button
                            type="button"
                            onClick={() => void runPush()}
                            disabled={gitBusy}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.08] disabled:opacity-40"
                          >
                            Push
                          </button>
                        </div>
                      </div>

                      {gitError ? (
                        <p className="text-xs text-red-400">{gitError}</p>
                      ) : null}

                      {(gitStatus || gitOutput) ? (
                        <div className="grid gap-3 lg:grid-cols-2">
                          {gitStatus ? (
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/35">Working tree</p>
                              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/60">
                                {gitStatus.status}
                              </pre>
                            </div>
                          ) : null}
                          {gitStatus ? (
                            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                              <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/35">Recent commits</p>
                              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/60">
                                {gitStatus.recentCommits}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {gitOutput ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Last command output</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => void copyGitOutput()}
                                className="text-[11px] text-white/45 transition-colors hover:text-white/75"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => setGitOutput('')}
                                className="text-[11px] text-white/45 transition-colors hover:text-white/75"
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/70">
                            {gitOutput}
                          </pre>
                        </div>
                      ) : null}

                      <p className="text-[11px] text-white/30">
                        {gitStatus?.repoRoot}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      <style jsx>{`
        .bg-grid-pattern {
          background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
}
