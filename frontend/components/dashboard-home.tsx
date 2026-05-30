'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { AppAccountMenu } from '@/components/scanner-account-menu';
import {
  AppLaunchCard,
  DashboardSection,
  ExternalArrow,
  ServiceHealthRow,
  StatusBadge,
  formatAggregatePresentation,
  type HealthStatus,
} from '@/components/dashboard-ui';
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


  const toHealthStatus = (status?: ServiceStatus['status']): HealthStatus =>
    status ?? 'loading';

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

  const backendOverallStatus: HealthStatus = backendOffline
    ? 'offline'
    : backendDegraded
      ? 'degraded'
      : backendHealthy
        ? 'online'
        : 'loading';

  const frontendOverallStatus: HealthStatus = frontendOffline
    ? 'offline'
    : frontendHealthy
      ? 'online'
      : 'loading';

  const firstFrontendIssue = frontendHealthValues.find(
    (service) => service.status === 'offline' || service.status === 'degraded',
  );
  const firstBackendIssue = backendHealthValues.find(
    (service) => service.status === 'offline' || service.status === 'degraded',
  );
  const frontendAggregate = formatAggregatePresentation(
    frontendOverallStatus,
    'frontend',
    firstFrontendIssue?.error,
  );
  const backendAggregate = formatAggregatePresentation(
    backendOverallStatus,
    'backend',
    firstBackendIssue?.error,
  );

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
    <div className="min-h-screen overflow-x-hidden bg-brand-light-gray text-brand-black antialiased" dir="ltr">
      <div className="relative z-10 flex min-h-screen flex-col">
        <header
          className={`sticky top-0 z-[200] border-b-4 border-brand-burgundy bg-brand-white shadow-[0_4px_24px_-8px_rgba(30,30,30,0.12)] transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'}`}
        >
          <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <img
                src="/Lorenzo_Logo1.png"
                alt="Lorenzo"
                width={168}
                height={56}
                className="h-9 w-auto max-h-12 max-w-[6.75rem] shrink-0 object-contain object-left sm:h-10 sm:max-w-[8rem] md:h-12 md:max-w-[9.5rem]"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-black">Dashboard</p>
                <p className="truncate text-xs text-brand-dark-gray">Chandelier platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              <StatusBadge
                status={frontendOverallStatus}
                label={frontendAggregate.label}
                hint={frontendAggregate.hint}
                size="md"
                surface="light"
              />
              <span
                className={`hidden rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide sm:inline-flex ${isLocal ? 'border-brand-burgundy bg-brand-burgundy text-brand-white' : 'border-brand-medium-gray/40 bg-brand-light-gray text-brand-black'}`}
              >
                {isLocal ? 'Local' : 'Production'}
              </span>
              <AppAccountMenu
                app="frontend"
                surface="light"
                className="shrink-0"
                onAuthChange={() => void refreshAuth()}
              />
            </div>
          </div>
        </header>

        <main className="container mx-auto flex-1 px-6 py-10 md:py-14">
          <div className="mx-auto max-w-7xl">
            <section
              className={`dash-hero mb-14 transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <p className="dash-eyebrow relative z-10">Control center</p>
              <h1 className="relative z-10 mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-brand-white md:text-5xl">
                Launch apps. Monitor health. Track live data.
              </h1>
              <p className="relative z-10 mt-4 max-w-2xl text-lg leading-relaxed text-brand-light-gray">
                One hub for Products, Scanner, Trainer, and Marketing — with real-time service checks and MongoDB stats.
              </p>
              <div className="relative z-10 mt-8 flex flex-wrap gap-3">
                <StatusBadge
                  status={backendOverallStatus}
                  label={backendAggregate.label}
                  hint={backendAggregate.hint}
                  size="md"
                  surface="dark"
                />
                <StatusBadge
                  status={frontendOverallStatus}
                  label={frontendAggregate.label}
                  hint={frontendAggregate.hint}
                  size="md"
                  surface="dark"
                />
                <span className="inline-flex items-center rounded-full border border-brand-white/30 bg-brand-white/10 px-3 py-1 text-xs font-medium text-brand-white">
                  Auto-refresh · 30s
                </span>
              </div>
            </section>

            <DashboardSection
              eyebrow="Applications"
              title="Quick launch"
              description="Open a frontend app in a new tab. Status reflects live reachability."
              className={`mb-14 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                <AppLaunchCard
                  href={href(productsUrl)}
                  serviceName="Products App"
                  title="Products Manager"
                  description="Browse and manage the product catalog, media, and imports."
                  status={toHealthStatus(frontendStatuses['Products App']?.status)}
                  responseTime={frontendStatuses['Products App']?.responseTime}
                  error={frontendStatuses['Products App']?.error}
                  detail={frontendStatuses['Products App']?.detail}
                  icon={
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                />
                <AppLaunchCard
                  href={href(scannerUrl)}
                  serviceName="Scanner UI"
                  title="Scanner UI"
                  description="Live camera scanning with YOLO detection and product matching."
                  status={toHealthStatus(frontendStatuses['Scanner UI']?.status)}
                  responseTime={frontendStatuses['Scanner UI']?.responseTime}
                  error={frontendStatuses['Scanner UI']?.error}
                  detail={frontendStatuses['Scanner UI']?.detail}
                  icon={
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                />
                <AppLaunchCard
                  href={href(trainerUrl)}
                  serviceName="Trainer Web"
                  title="Trainer Dashboard"
                  description="Label datasets, train models, and publish to production."
                  status={toHealthStatus(frontendStatuses['Trainer Web']?.status)}
                  responseTime={frontendStatuses['Trainer Web']?.responseTime}
                  error={frontendStatuses['Trainer Web']?.error}
                  detail={frontendStatuses['Trainer Web']?.detail}
                  icon={
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  }
                />
                <AppLaunchCard
                  href={href(marketingUrl)}
                  serviceName="Marketing App"
                  title="Digital Marketing OS"
                  description="Campaign planning, content calendar, and brand workflows."
                  status={toHealthStatus(frontendStatuses['Marketing App']?.status)}
                  responseTime={frontendStatuses['Marketing App']?.responseTime}
                  error={frontendStatuses['Marketing App']?.error}
                  detail={frontendStatuses['Marketing App']?.detail}
                  icon={
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
              </div>
            </DashboardSection>

            <DashboardSection
              eyebrow="Infrastructure"
              title="Backend health"
              description="Health JSON endpoints for APIs and database. Click a row to inspect."
              className={`mb-14 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
            >
              <div className="dash-panel">
                <ServiceHealthRow
                  href={href(backendHealthUrl)}
                  name="Inference API"
                  url={backendHealthUrl}
                  status={toHealthStatus(backendStatuses['Inference API']?.status)}
                  responseTime={backendStatuses['Inference API']?.responseTime}
                  detail={backendStatuses['Inference API']?.detail}
                  error={backendStatuses['Inference API']?.error}
                />
                <ServiceHealthRow
                  href={href(trainerHealthUrl)}
                  name="Trainer API"
                  url={trainerHealthUrl}
                  status={toHealthStatus(backendStatuses['Trainer API']?.status)}
                  responseTime={backendStatuses['Trainer API']?.responseTime}
                  error={backendStatuses['Trainer API']?.error}
                />
                <ServiceHealthRow
                  href={href(mongodbHealthUrl)}
                  name="MongoDB"
                  url={mongodbHealthUrl}
                  status={toHealthStatus(backendStatuses['MongoDB']?.status)}
                  responseTime={backendStatuses['MongoDB']?.responseTime}
                  error={backendStatuses['MongoDB']?.error}
                />

                <ExternalLink
                  href={href(statusUrl)}
                  className="group flex items-center justify-between gap-4 border-t border-brand-light-gray bg-brand-light-gray/50 px-5 py-4 transition-colors hover:bg-brand-burgundy/10"
                >
                  <div>
                    <p className="text-sm font-semibold text-brand-black">Detailed status page</p>
                    <p className="mt-1 text-sm text-brand-dark-gray">
                      {backendOffline
                        ? 'Some backend APIs are down'
                        : backendDegraded
                          ? 'Backend performance is degraded'
                          : backendHealthy
                            ? 'All backend APIs operational'
                            : 'Checking backend services…'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge
                      status={backendOverallStatus}
                      label={backendAggregate.label}
                      hint={backendAggregate.hint}
                      size="md"
                      surface="light"
                    />
                    <ExternalArrow />
                  </div>
                </ExternalLink>
              </div>
            </DashboardSection>

            <PlatformOverview visible={isVisible} />

            {isLocal && (
              <DashboardSection
                eyebrow="Developer tools"
                title="Local Git"
                description="Admin-only commit and push from this machine."
                action={
                  gitStatus ? (
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm text-brand-black">{gitStatus.branch}</span>
                      <StatusBadge
                        status={isGitClean ? 'online' : 'degraded'}
                        label={isGitClean ? 'Clean' : `${gitWorkingTreeMetrics.total} changes`}
                        hint={isGitClean ? undefined : 'Uncommitted local changes'}
                        size="md"
                        surface="light"
                      />
                    </div>
                  ) : null
                }
                className={`mt-4 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
              >
                <div className="dash-panel">
                  <div className="flex flex-col gap-4 border-b border-brand-light-gray px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      {authLoading ? (
                        <p className="text-sm text-brand-dark-gray">Checking auth…</p>
                      ) : authUser ? (
                        <p className="text-sm text-brand-dark-gray">
                          <span className="font-semibold text-brand-black">{authUser.username || authUser.email || 'user'}</span>
                          <span className="text-brand-medium-gray"> · </span>
                          <span className="uppercase tracking-wider text-xs text-brand-medium-gray">
                            {authUser.role || (authUser.is_admin ? 'admin' : 'user')}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-brand-dark-gray">Sign in as admin to use git controls.</p>
                      )}
                      {authError ? <p className="mt-1 text-xs font-medium text-brand-burgundy">{authError}</p> : null}
                    </div>

                    {!canManageLocalGit ? (
                      <Link
                        href={href(trainerLoginUrl)}
                        className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-burgundy px-4 py-2 text-xs font-semibold text-brand-white transition-opacity hover:opacity-90"
                      >
                        Sign in via Trainer
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void refreshGitStatus()}
                        disabled={gitBusy}
                        className="inline-flex shrink-0 items-center justify-center rounded-full border border-brand-medium-gray/40 bg-brand-light-gray px-4 py-2 text-xs font-medium text-brand-black transition-colors hover:border-brand-burgundy/40 disabled:opacity-40"
                      >
                        {gitBusy ? 'Refreshing…' : 'Refresh status'}
                      </button>
                    )}
                  </div>

                  {gitStatus ? (
                    <div className="grid grid-cols-2 gap-px bg-brand-light-gray md:grid-cols-4">
                      {[
                        { label: 'Modified', value: gitWorkingTreeMetrics.modified },
                        { label: 'Added', value: gitWorkingTreeMetrics.added },
                        { label: 'Deleted', value: gitWorkingTreeMetrics.deleted },
                        { label: 'Untracked', value: gitWorkingTreeMetrics.untracked },
                      ].map((item) => (
                        <div key={item.label} className="bg-brand-white px-5 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-medium-gray">{item.label}</p>
                          <p className="mt-2 text-2xl font-light tabular-nums text-brand-black">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {canManageLocalGit ? (
                    <div className="space-y-4 border-t border-brand-light-gray px-5 py-5">
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
                            className="rounded-full border border-brand-medium-gray/40 bg-brand-light-gray px-3 py-1.5 text-xs text-brand-black transition-colors hover:border-brand-burgundy hover:bg-brand-burgundy/10 hover:text-brand-burgundy"
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
                          className="min-w-0 flex-1 rounded-xl border border-brand-medium-gray/40 bg-brand-white px-4 py-3 text-sm text-brand-black placeholder:text-brand-medium-gray focus:border-brand-burgundy focus:outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void runCommit()}
                            disabled={gitBusy || !gitMessage.trim()}
                            className="rounded-xl bg-brand-burgundy px-5 py-3 text-sm font-semibold text-brand-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            Commit
                          </button>
                          <button
                            type="button"
                            onClick={() => void runPush()}
                            disabled={gitBusy}
                            className="rounded-xl border border-brand-black px-5 py-3 text-sm font-medium text-brand-black transition-colors hover:bg-brand-black hover:text-brand-white disabled:opacity-40"
                          >
                            Push
                          </button>
                        </div>
                      </div>

                      {gitError ? <p className="text-xs font-medium text-brand-burgundy">{gitError}</p> : null}

                      {(gitStatus || gitOutput) ? (
                        <div className="grid gap-4 lg:grid-cols-2">
                          {gitStatus ? (
                            <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-4">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-medium-gray">Working tree</p>
                              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-brand-black">
                                {gitStatus.status}
                              </pre>
                            </div>
                          ) : null}
                          {gitStatus ? (
                            <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-4">
                              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-medium-gray">Recent commits</p>
                              <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-brand-black">
                                {gitStatus.recentCommits}
                              </pre>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {gitOutput ? (
                        <div className="rounded-xl border border-brand-light-gray bg-brand-light-gray/50 p-4">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-medium-gray">Last command output</p>
                            <div className="flex gap-3">
                              <button type="button" onClick={() => void copyGitOutput()} className="text-xs text-brand-burgundy hover:text-brand-black">
                                Copy
                              </button>
                              <button type="button" onClick={() => setGitOutput('')} className="text-xs text-brand-burgundy hover:text-brand-black">
                                Clear
                              </button>
                            </div>
                          </div>
                          <pre className="max-h-36 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-brand-black">
                            {gitOutput}
                          </pre>
                        </div>
                      ) : null}

                      <p className="font-mono text-[11px] text-brand-medium-gray">{gitStatus?.repoRoot}</p>
                    </div>
                  ) : null}
                </div>
              </DashboardSection>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
