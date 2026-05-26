'use client';

import * as React from 'react';

const DISMISS_KEY = 'products:pwa-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const mediaStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true;
  return iosStandalone || mediaStandalone;
}

export function PwaInstallFab({ raised }: { raised?: boolean }) {
  const [promptEvent, setPromptEvent] = React.useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = React.useState(true);
  const [installing, setInstalling] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    if (dismissed || isStandaloneMode()) {
      setHidden(true);
      return;
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    };

    const onInstalled = () => {
      setHidden(true);
      setPromptEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleDismiss = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setHidden(true);
    setPromptEvent(null);
  }, []);

  const handleInstall = React.useCallback(async () => {
    if (!promptEvent) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome !== 'accepted') {
        setHidden(false);
      }
    } finally {
      setPromptEvent(null);
      setInstalling(false);
    }
  }, [promptEvent]);

  if (hidden || !promptEvent) return null;

  return (
    <div
      className={
        'fixed right-3 z-40 sm:hidden ' +
        (raised ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]')
      }
    >
      <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-black/90 p-1 pl-2.5 text-white shadow-2xl backdrop-blur-md dark:bg-zinc-900/90">
        <button
          type="button"
          onClick={() => void handleInstall()}
          disabled={installing}
          className="rounded-full bg-emerald-500 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-white transition-colors hover:bg-emerald-400 disabled:opacity-60"
        >
          {installing ? 'Installing…' : 'Install App'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
          className="flex h-7 w-7 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
