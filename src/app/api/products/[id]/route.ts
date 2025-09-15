import { NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

// GET /api/users/[id] - fetch a single user by user_id
export async function GET(
    _request: Request,
    context: { params: { id: string } }
) {
    const productId = context.params.id;

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('product_id', productId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
}