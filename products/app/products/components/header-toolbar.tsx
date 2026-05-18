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
}: HeaderToolbarProps) {
  return (
    <div className="sticky top-0 z-40 -mx-5 px-5 py-2 border-b border-black/10 bg-white/95 backdrop-blur-md dark:border-white/10 dark:bg-black/80">
      {/* Mobile Header */}
      <div className="flex w-full min-w-0 items-center gap-2 sm:hidden">
        <div className="min-w-0 shrink overflow-hidden">
          {mobileTitleNode ?? <h1 className="truncate text-lg font-semibold">{title}</h1>}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-x-auto scrollbar-none">
          <div className="min-w-0 flex-1">{searchGroupNode}</div>
          <div className="flex shrink-0 items-center gap-1.5">
            {familyToggleNode}
            {viewToggleNode}
            {maxModeToggleNode}
            {themeToggleNode}
            <AccountMenu onAuthChange={fetchUserSession} />
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden w-full min-w-0 gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="flex min-w-0 max-w-[min(100%,20rem)] shrink items-center gap-4 overflow-hidden lg:max-w-[22rem]">
          <div className="min-w-0">
            {titleNode ?? <h1 className="truncate text-2xl font-semibold">{title}</h1>}
            <p className="mt-1 text-sm text-black/60 dark:text-white/55"></p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 pl-2">
          <div className="min-w-0 flex-1">{searchGroupNode}</div>
          <div className="flex shrink-0 items-center gap-2">
            {familyToggleNode}
            {viewToggleNode}
            {maxModeToggleNode}
            {themeToggleNode}
            <AccountMenu onAuthChange={fetchUserSession} />
          </div>
        </div>
      </div>
    </div>
  );
}
