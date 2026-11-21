const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

interface Attempts {
  count: number;
  resetAt: number;
}

// In-memory, per-instance limiter. On serverless platforms (Vercel) this resets
// between cold starts, so it's a best-effort brute-force deterrent — appropriate
// for a small family site. For stronger protection, back this with Turso/Upstash.
const attempts = new Map<string, Attempts>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

/** Best-effort client IP behind the Vercel proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-vercel-forwarded-for') ?? '0.0.0.0';
}

// Opportunistically prune expired entries without keeping the process alive.
const timer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) attempts.delete(key);
  }
}, WINDOW_MS);
if (typeof timer.unref === 'function') timer.unref();