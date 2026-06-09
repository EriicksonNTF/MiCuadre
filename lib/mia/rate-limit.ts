import "server-only"

/*
 * In-memory per-user rate limiter for MIA.
 *
 * Limits (per user.id from session):
 *   - 15 requests / minute   (MIA_RATE_LIMIT_PER_MINUTE, default 15)
 *   - 200 requests / day     (MIA_RATE_LIMIT_PER_DAY, default 200)
 *
 * Scope:
 *   - This is a BEST-EFFORT per-instance limiter. In Vercel serverless
 *     the in-memory state resets on cold start, so this does NOT replace
 *     an edge / distributed limiter (e.g. Upstash, Vercel Edge Config).
 *     For production hardening, add a distributed limiter behind the
 *     same checkRateLimit signature.
 *
 * Memory:
 *   - Expired buckets are reaped on the next checkRateLimit call for
 *     that user, so the map size is bounded by active user count per
 *     instance lifetime.
 */

type Bucket = {
  perMinute: { count: number; resetAt: number }
  perDay: { count: number; resetAt: number }
}

const buckets = new Map<string, Bucket>()

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60_000

const PER_MINUTE = Math.max(1, Number(process.env.MIA_RATE_LIMIT_PER_MINUTE) || 15)
const PER_DAY = Math.max(1, Number(process.env.MIA_RATE_LIMIT_PER_DAY) || 200)

export type RateLimitResult = {
  allowed: boolean
  remaining: { perMinute: number; perDay: number }
  retryAfterSeconds: number
}

export function checkRateLimit(userId: string): RateLimitResult {
  const now = Date.now()

  let bucket = buckets.get(userId)
  if (bucket && now >= bucket.perMinute.resetAt && now >= bucket.perDay.resetAt) {
    buckets.delete(userId)
    bucket = undefined
  }

  if (!bucket) {
    bucket = {
      perMinute: { count: 0, resetAt: now + MINUTE_MS },
      perDay: { count: 0, resetAt: now + DAY_MS },
    }
    buckets.set(userId, bucket)
  }

  if (now >= bucket.perMinute.resetAt) {
    bucket.perMinute = { count: 0, resetAt: now + MINUTE_MS }
  }
  if (now >= bucket.perDay.resetAt) {
    bucket.perDay = { count: 0, resetAt: now + DAY_MS }
  }

  bucket.perMinute.count += 1
  bucket.perDay.count += 1

  const overMinute = bucket.perMinute.count > PER_MINUTE
  const overDay = bucket.perDay.count > PER_DAY
  const allowed = !overMinute && !overDay

  const retryAfterSeconds = allowed
    ? 0
    : Math.max(
        Math.ceil((bucket.perMinute.resetAt - now) / 1000),
        Math.ceil((bucket.perDay.resetAt - now) / 1000),
      )

  return {
    allowed,
    remaining: {
      perMinute: Math.max(0, PER_MINUTE - bucket.perMinute.count),
      perDay: Math.max(0, PER_DAY - bucket.perDay.count),
    },
    retryAfterSeconds,
  }
}

export const MIA_RATE_LIMITED_RESPONSE = {
  error: "Too Many Requests",
  message:
    "Estas haciendo muchas preguntas seguidas. Tómate un respiro e intentalo de nuevo en un minuto.",
  requiresUpgrade: false,
} as const
