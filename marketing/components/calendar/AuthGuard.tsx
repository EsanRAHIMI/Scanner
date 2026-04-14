'use client';

import React from 'react';
import { TrainerMe } from '../../lib/calendar/types';

interface AuthGuardProps {
  authRequired: boolean;
  me: TrainerMe | null;
  onLogin: (email: string, pass: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onCloseAuth: () => void;
  isSaving: boolean;
  loginError: string | null;
}

export function AuthGuard({
  authRequired,
  me,
  onLogin,
  onLogout,
  onCloseAuth,
  isSaving,
  loginError,
}: AuthGuardProps) {
  const [loginEmail, setLoginEmail] = React.useState('');
  const [loginPassword, setLoginPassword] = React.useState('');

  if (!authRequired) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCloseAuth} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-popover p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Sign in required</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Please sign in to access the Content Calendar management tools.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted transition-colors"
            onClick={onCloseAuth}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form 
          className="grid gap-4" 
          onSubmit={(e) => {
            e.preventDefault();
            onLogin(loginEmail, loginPassword);
          }}
        >
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
              placeholder="name@company.com"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/60 ml-1">Password</label>
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-muted/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/40"
              placeholder="••••••••"
              required
            />
          </div>

          {loginError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive font-medium tabular-nums animate-in shake-in duration-300">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving || !loginEmail || !loginPassword}
            className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/10"
          >
            {isSaving ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
