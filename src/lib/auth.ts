import { createHmac, timingSafeEqual } from 'node:crypto';

/** Name of the HttpOnly cookie holding the signed admin session. */
export const SESSION_COOKIE = 'family_admin';

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function adminUsername() {
  return process.env.ADMIN_USERNAME || 'admin';
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || 'admin';
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || 'family-recipes-dev-session-secret';
}

function sign(payload: string) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export interface AdminSession {
  username: string;
}

/** Constant-time comparison so the password check leaks no timing information. */
function constantTimeEqual(left: string, right: string): boolean {
  const a = createHmac('sha256', sessionSecret()).update(left).digest();
  const b = createHmac('sha256', sessionSecret()).update(right).digest();
  return timingSafeEqual(a, b);
}

export function checkCredentials(username: string, password: string): boolean {
  // Evaluate both comparisons unconditionally to avoid short-circuit timing leaks.
  const usernameOk = constantTimeEqual(username, adminUsername());
  const passwordOk = constantTimeEqual(password, adminPassword());
  return usernameOk && passwordOk;
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ sub: username, exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000 })
  ).toString('base64url');

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): AdminSession | null {
  if (!token) return null;

  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const provided = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (provided.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(provided, expectedBuffer)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown;
      exp?: unknown;
    };

    if (typeof data.sub !== 'string' || typeof data.exp !== 'number') return null;
    if (data.exp < Date.now()) return null;

    return { username: data.sub };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }

  return cookies;
}

export function getSession(request: Request): AdminSession | null {
  const cookies = parseCookies(request.headers.get('cookie'));
  return verifySessionToken(cookies[SESSION_COOKIE]);
}

export function isAuthenticated(request: Request): boolean {
  return getSession(request) !== null;
}

/** Set-Cookie value for a freshly signed-in admin. */
export function sessionCookie(token: string): string {
  const flags = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];

  // Only over HTTPS in production (Vercel sets NODE_ENV=production); dev runs on
  // plain http://localhost, where a Secure cookie would be silently dropped.
  if (process.env.NODE_ENV === 'production') flags.push('Secure');

  return flags.join('; ');
}

/** Set-Cookie value that clears the session. */
export function expiredSessionCookie(): string {
  const flags = ['Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (process.env.NODE_ENV === 'production') flags.push('Secure');
  return `${SESSION_COOKIE}=; ${flags.join('; ')}`;
}

export function jsonResponse(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(headers as Record<string, string>) },
  });
}

export function redirectResponse(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 303, headers });
}

/** Only allow same-site paths as post-login redirect targets. */
export function safeNextPath(value: string | null | undefined, fallback = '/admin'): string {
  if (!value) return fallback;
  // Reject protocol-relative (//) and backslash (/\evil.com) redirects, plus
  // control characters, which some browsers normalise into the same open redirect.
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\\\u0000-\u001f]/.test(value)) return fallback;
  return value;
}
