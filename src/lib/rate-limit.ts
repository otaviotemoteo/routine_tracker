// In-memory sliding-window limiter for FAILED login attempts, keyed by IP.
// Successful logins clear the counter; only wrong passwords count.
//
// Serverless caveat (documented in docs/ARCHITECTURE.md): the Map lives per
// instance, so a cold start resets it. For a single-user app this still
// shuts down naive brute force; a durable limiter (Upstash, Vercel WAF)
// would be the multi-user upgrade path.

interface AttemptWindow {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const failures = new Map<string, AttemptWindow>();

function prune(now: number): void {
  for (const [key, attempt] of failures) {
    if (now - attempt.windowStart >= WINDOW_MS) failures.delete(key);
  }
}

export function isLoginBlocked(key: string): {
  blocked: boolean;
  retryAfterMinutes: number;
} {
  const now = Date.now();
  prune(now);
  const attempt = failures.get(key);
  if (!attempt || attempt.count < MAX_FAILURES) {
    return { blocked: false, retryAfterMinutes: 0 };
  }
  const retryAfterMinutes = Math.max(
    1,
    Math.ceil((attempt.windowStart + WINDOW_MS - now) / 60_000)
  );
  return { blocked: true, retryAfterMinutes };
}

export function registerLoginFailure(key: string): void {
  const now = Date.now();
  const attempt = failures.get(key);
  if (!attempt || now - attempt.windowStart >= WINDOW_MS) {
    failures.set(key, { count: 1, windowStart: now });
    return;
  }
  attempt.count += 1;
}

export function clearLoginFailures(key: string): void {
  failures.delete(key);
}
