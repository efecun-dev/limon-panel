import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJwtToken } from './lib/auth';

const publicPaths = ['/login', '/api/auth/login', '/api/trendyol-webhook'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and public paths bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    publicPaths.includes(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;

  if (!token) {
    // API request redirect to 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Yetkisiz erişim' }, { status: 401 });
    }
    // Web request redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyJwtToken(token);

  if (!payload) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Geçersiz veya süresi dolmuş oturum' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth/login).*)'],
};
