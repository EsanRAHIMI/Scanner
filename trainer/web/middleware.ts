import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const basePath = req.nextUrl.basePath ?? '/trainer';

  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return NextResponse.next();
  }

  const loggedInMarker = req.cookies.get('trainer_logged_in')?.value;
  if (loggedInMarker !== '1') {
    if (pathname.startsWith('/api')) {
      if (pathname.startsWith('/api/auth/')) {
        return NextResponse.next();
      }
      return NextResponse.json({ detail: 'NOT_AUTHENTICATED' }, { status: 401 });
    }

    const url = req.nextUrl.clone();
    url.pathname = '/login';
    const nextPath = `${basePath}${pathname}`;
    const nextWithQuery = `${nextPath}${req.nextUrl.search ?? ''}`;
    url.searchParams.set('next', nextWithQuery);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
