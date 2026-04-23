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
      <div className="flex w-full items-center justify-between gap-2 sm:hidden">
        {mobileTitleNode ?? <h1 className="min-w-0 flex-none truncate text-lg font-semibold">{title}</h1>}
        <div className="flex flex-none items-center gap-2">
          {searchGroupNode}
          {familyToggleNode}
          {viewToggleNode}
          {maxModeToggleNode}
          {themeToggleNode}
          <AccountMenu onAuthChange={fetchUserSession} />
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden w-full sm:flex sm:items-center sm:justify-between">
        <div>
          {titleNode ?? <h1 className="text-2xl font-semibold">{title}</h1>}
          <p className="mt-1 text-sm text-black/60 dark:text-white/55"></p>
        </div>

        <div className="flex items-center gap-2">
          {searchGroupNode}
          <div className="flex items-center gap-2 ml-2">
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
