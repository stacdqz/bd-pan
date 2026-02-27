import { NextResponse } from 'next/server';
import { signAdminToken } from '../_auth';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const adminPwd = process.env.ADMIN_PASSWORD;
        if (!adminPwd || password !== adminPwd) {
            return NextResponse.json({ error: '密码错误喵...' }, { status: 401 });
        }
        const token = signAdminToken();
        if (!token) {
            return NextResponse.json({ error: '服务端配置异常' }, { status: 500 });
        }
        return NextResponse.json({ token });
    } catch {
        return NextResponse.json({ error: '登录接口异常' }, { status: 500 });
    }
}
