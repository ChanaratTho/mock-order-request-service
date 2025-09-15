import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require auth
const PUBLIC_PATHS = [
    '/login',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
];

function isPublicPath(pathname: string) {
    if (PUBLIC_PATHS.includes(pathname)) return true;
    // Allow Next internals and static assets
    if (pathname.startsWith('/_next')) return true;
    // API routes are excluded by matcher below; this is a safeguard for dev variations
    if (pathname.startsWith('/api/login')) return true;
    return false;
}

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (isPublicPath(pathname)) {
        return NextResponse.next();
    }

    const auth = request.cookies.get('auth')?.value;
    if (!auth) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        // Apply to all routes except:
        // - API routes
        // - Next.js static assets and image optimizer
        // - Any file with an extension (e.g., .ico, .svg, .png, .css, .js)
        '/((?!api|_next/static|_next/image|.*\\..*|favicon.ico).*)',
    ],
};
