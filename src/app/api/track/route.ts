import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: Request) {
    if (!supabase) {
        return NextResponse.json({ error: 'Supabase 未配置' }, { status: 500 });
    }

    try {
        const { time, source, pathname, device } = await req.json();

        const headers = req.headers;
        const ip = headers.get('x-forwarded-for') || headers.get('x-real-ip') || '127.0.0.1';

        // 如果想要位置，可以调用一个免费服务，或者如果使用 Vercel，它会在 header 里带 x-vercel-ip-city 等
        // 简单起见，这里假设直接存这些信息
        const city = headers.get('x-vercel-ip-city') || 'Unknown';
        const country = headers.get('x-vercel-ip-country') || 'Unknown';
        const region = headers.get('x-vercel-ip-country-region') || 'Unknown';
        const location = `${country} ${region} ${city}`.trim();

        const { data, error } = await supabase
            .from('view_list')
            .insert([
                {
                    visit_time: time || new Date().toISOString(),
                    ip_address: ip.split(',')[0].trim(),
                    country: country,
                    region: region,
                    city: city,
                    page_source: source || 'bd-pan',
                    // 如果 view_list 表包含 device 等列，可以根据情况插入
                }
            ]);

        // 如果插入出错，或者 view_list 不存在，可能他们用的是 view_logs，提供一个防御
        if (error && error.code === '42P01') { // table does not exist
            // 尝试插入到 view_logs 表，这也是他们经常使用的表名
            await supabase.from('view_logs').insert([
                {
                    visit_time: time || new Date().toISOString(),
                    ip_address: ip.split(',')[0].trim(),
                    country: country,
                    region: region,
                    city: city,
                    page_source: source || 'bd-pan',
                }
            ]);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
