/**
 * A minimal in-memory, per-process rate limiter (5 requests / 10 minutes /
 * IP by default) for `POST /api/membership`. It intentionally does not
 * persist anywhere: a load-balanced deployment gets independent limits per
 * app instance, which is an acceptable tradeoff for a "no more than a
 * handful of submissions" guard, not a security boundary.
 *
 * State is cached on `globalThis` so the Next.js dev server's module reloads
 * don't reset it on every save.
 */

interface Bucket {
  timestamps: number[];
}

const globalForRateLimit = globalThis as unknown as {
  __sgsmRateLimitBuckets?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> =
  globalForRateLimit.__sgsmRateLimitBuckets ?? (globalForRateLimit.__sgsmRateLimitBuckets = new Map());

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  { max = 5, windowMs = 10 * 60 * 1000 }: { max?: number; windowMs?: number } = {}
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

  if (bucket.timestamps.length >= max) {
    const oldest = bucket.timestamps[0] ?? now;
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, windowMs - (now - oldest)) };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: max - bucket.timestamps.length, retryAfterMs: 0 };
}

/** Best-effort client IP extraction from the standard forwarding headers. */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}
