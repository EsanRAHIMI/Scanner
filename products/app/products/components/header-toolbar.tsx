import * as React from 'react';
import { AccountMenu } from './account-menu';

interface HeaderToolbarProps {
  title: string;
  titleNode?: React.ReactNode;
  mobileTitleNode?: React.ReactNode;
  searchGroupNode: React.ReactNode;
  familyToggleNode: React.ReactNode;
  viewToggleNode: React.ReactNode;
  maxModeToggleNode: React.ReactNode;
  themeToggleNode: React.ReactNode;
  fetchUserSession: () => void;
  onActivityLogs?: () => void;
  backendDisconnected?: boolean;
  addProductButton?: React.ReactNode;
}

function HeaderToggleCluster({
  familyToggleNode,
  viewToggleNode,
  maxModeToggleNode,
  themeToggleNode,
  compact,
}: Pick<
  HeaderToolbarProps,
  'familyToggleNode' | 'viewToggleNode' | 'maxModeToggleNode' | 'themeToggleNode'
> & { compact?: boolean }) {
  return (
    <div
      className={
        'flex shrink-0 items-center gap-1 ' +
        (compact ? '[&_button]:!h-8 [&_button]:!w-8 [&_button_svg]:!h-4 [&_button_svg]:!w-4' : 'gap-1.5 sm:gap-2')
      }
    >
      {familyToggleNode}
      {viewToggleNode}
      {maxModeToggleNode}
      {themeToggleNode}
    </div>
  );
}

export function HeaderToolbar({
  title,
  titleNode,
  mobileTitleNode,
  searchGroupNode,
  familyToggleNode,
  viewToggleNode,
  maxModeToggleNode,
  themeToggleNode,
  fetchUserSession,
  onActivityLogs,
  backendDisconnected = false,
  addProductButton,
}: HeaderToolbarProps) {
  const togglesMobile = (
    <HeaderToggleCluster
      compact
      familyToggleNode={familyToggleNode}
      viewToggleNode={viewToggleNode}
      maxModeToggleNode={maxModeToggleNode}
      themeToggleNode={themeToggleNode}
    />
  );

  const togglesDesktop = (
    <HeaderToggleCluster
      familyToggleNode={familyToggleNode}
      viewToggleNode={viewToggleNode}
      maxModeToggleNode={maxModeToggleNode}
      themeToggleNode={themeToggleNode}
    />
  );

  return (
    <header className="sticky top-0 z-40 -mx-5 border-b-2 border-brand-burgundy bg-brand-white/95 px-5 py-2 shadow-[0_4px_24px_-12px_rgba(30,30,30,0.18)] backdrop-blur-md dark:border-emerald-500/70 dark:bg-black/80 sm:py-2.5">
      {/* Mobile: one row — logo | search | icons | menu */}
      <div className="flex min-h-9 w-full min-w-0 items-center gap-1.5 sm:hidden">
        {mobileTitleNode ?? <span className="shrink-0 text-sm font-semibold">{title}</span>}

        <div className="min-w-0 flex-1 basis-0 self-stretch">{searchGroupNode}</div>

        <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto scrollbar-none">
          {addProductButton}
          {togglesMobile}
        </div>

        <div className="shrink-0">
          <AccountMenu
            onAuthChange={fetchUserSession}
            onActivityLogs={onActivityLogs}
            backendDisconnected={backendDisconnected}
          />
        </div>
      </div>

      {/* Desktop — tight gap next to logo on narrower widths so search gets more room */}
      <div className="hidden w-full min-w-0 items-center gap-1.5 sm:flex md:gap-2 lg:gap-3">
        <div className="shrink-0 overflow-hidden">
          {titleNode ?? <h1 className="truncate text-xl font-semibold tracking-tight lg:text-2xl">{title}</h1>}
        </div>

        <div className="min-w-0 flex-1 basis-0">{searchGroupNode}</div>

        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          {addProductButton}
          {togglesDesktop}
          <AccountMenu
            onAuthChange={fetchUserSession}
            onActivityLogs={onActivityLogs}
            backendDisconnected={backendDisconnected}
          />
        </div>
      </div>
    </header>
  );
}
