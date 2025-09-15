import { NextRequest, NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

export async function GET() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('product_id', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? [], { status: 200 });
}

export async function POST(request: NextRequest) {
    try {
        const contentType = request.headers.get('content-type') || '';
        let body: unknown;

        if (contentType.includes('application/json')) {
            body = await request.json();
        } else if (contentType.includes('text/plain')) {
            body = await request.text();
        } else {
            // Fallback: try text for other content types
            body = await request.text();
        }

        // Log to server console for testing/inspection
        const now = new Date().toISOString();
        console.log(`[${now}] [POST /api/products] content-type=${contentType}`);
        console.log(`[${now}] [POST /api/products] body =>`, body);

        // Echo back the received body for testing
        return NextResponse.json({ body }, { status: 200 });
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}