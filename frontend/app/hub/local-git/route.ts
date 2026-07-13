import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';

import { getTrainerApiBase } from '@/lib/env';

const execFileAsync = promisify(execFile);
const REPO_ROOT = process.env.LOCAL_GIT_REPO_ROOT || '/Users/ehsanrahimi/Works/scanner';

type GitAction = 'status' | 'commit' | 'push';

function isLocalRequest(req: Request): boolean {
  const host = req.headers.get('host') || '';
  return host.includes('localhost') || host.includes('127.0.0.1');
}

function resolveTrainerBase(req: Request) {
  const base = getTrainerApiBase();
  const host = req.headers.get('host') || '';
  const local = host.includes('localhost') || host.includes('127.0.0.1');
  if (local && !base.startsWith('http')) return 'http://localhost:8010';
  if (base.startsWith('/')) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}${base}`;
  }
  return base;
}

async function isAuthorized(req: Request): Promise<boolean> {
  if (!isLocalRequest(req)) return false;
  try {
    const meRes = await fetch(`${resolveTrainerBase(req)}/auth/me`, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        cookie: req.headers.get('cookie') ?? '',
        authorization: req.headers.get('authorization') ?? '',
      },
    });
    if (!meRes.ok) return false;
    const me = (await meRes.json()) as { is_admin?: boolean; role?: string | null };
    const role = (me.role || '').toLowerCase();
    return Boolean(me.is_admin) || role === 'admin';
  } catch {
    return false;
  }
}

async function runGit(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('git', args, {
    cwd: REPO_ROOT,
    env: process.env,
    maxBuffer: 2 * 1024 * 1024,
  });
  return `${stdout}${stderr}`.trim();
}

async function getStatusPayload() {
  const [branch, status, log] = await Promise.all([
    runGit(['rev-parse', '--abbrev-ref', 'HEAD']),
    runGit(['status', '--short']),
    runGit(['log', '--oneline', '-5']),
  ]);

  return {
    repoRoot: REPO_ROOT,
    branch: branch.trim(),
    status: status || '(clean)',
    recentCommits: log || '(no commits)',
  };
}

export async function GET(req: Request) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const payload = await getStatusPayload();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      action?: GitAction;
      message?: string;
      stageAll?: boolean;
    };
    const action = body.action;

    if (action === 'status') {
      const payload = await getStatusPayload();
      return NextResponse.json(payload);
    }

    if (action === 'commit') {
      const message = (body.message || '').trim();
      if (!message) {
        return NextResponse.json({ error: 'commit_message_required' }, { status: 400 });
      }

      await runGit(['add', body.stageAll === false ? '-u' : '.']);
      const commitOutput = await runGit(['commit', '-m', message]);
      const payload = await getStatusPayload();
      return NextResponse.json({ commitOutput, ...payload });
    }

    if (action === 'push') {
      const pushOutput = await runGit(['push', 'origin', 'HEAD']);
      const payload = await getStatusPayload();
      return NextResponse.json({ pushOutput, ...payload });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
