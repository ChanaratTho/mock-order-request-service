import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { username, password } = await request.json();

        if (username === 'adminG4' && password === 'Pass@cs341') {
            // Build response and set cookie on it
            const res = NextResponse.json({ success: true });
            res.cookies.set('auth', 'ok', {
                httpOnly: true,
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24,
                path: '/',
            });
            return res;
        }

        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}
