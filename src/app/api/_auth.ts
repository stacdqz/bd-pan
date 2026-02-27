import crypto from 'crypto';

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000; // 2 小时

function getSecret() {
    return process.env.ADMIN_TOKEN_SECRET || '';
}

export function signAdminToken() {
    const secret = getSecret();
    if (!secret) return null;

    const payload = {
        exp: Date.now() + TOKEN_TTL_MS,
    };
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64url');

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadB64);
    const sig = hmac.digest('hex');

    return `${payloadB64}.${sig}`;
}

export function verifyAdminToken(authHeader?: string): boolean {
    const secret = getSecret();
    if (!secret) return false;
    if (!authHeader) return false;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return false;

    const token = parts[1];
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return false;

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadB64);
    const expectedSig = hmac.digest('hex');
    if (expectedSig !== sig) return false;

    try {
        const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
        const payload = JSON.parse(payloadStr) as { exp?: number };
        if (!payload.exp || typeof payload.exp !== 'number') return false;
        if (Date.now() > payload.exp) return false;
        return true;
    } catch {
        return false;
    }
}
