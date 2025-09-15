import { NextRequest, NextResponse } from "next/server";
import { supabase } from '@/lib/supabase';

// GET /api/users/[id] - fetch a single user by user_id
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id: userId } = await context.params;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(data, { status: 200 });
}