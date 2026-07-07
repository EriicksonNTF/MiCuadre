import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { getRedis } from "@/lib/upstash"

/*
 * Per-user rate limiter for MIA (persistent via Upstash, in-memory fallback).
 *
 * Limits (per user.id from session):
 *   - 15 requests / minute   (MIA_RATE_LIMIT_PER_MINUTE, default 15)
 *   - 200 requests / day     (MIA_RATE_LIMIT_PER_DAY, default 200)
 */

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * 60_000

const PER_MINUTE = Math.max(1, Number(process.env.MIA_RATE_LIMIT_PER_MINUTE) || 15)
const PER_DAY = Math.max(1, Number(process.env.MIA_RATE_LIMIT_PER_DAY) || 200)

export type RateLimitResult = {
  allowed: boolean
  remaining: { perMinute: number; perDay: number }
  retryAfterSeconds: number
}

/* ── In-memory fallback ──────────────────────────────────────────── */

type Bucket = {
  perMinute: { count: number; resetAt: number }
  perDay: { count: number; resetAt: number }
}
const buckets = new Map<string, Bucket>()

// Periodic cleanup of expired entries to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (now >= bucket.perMinute.resetAt && now >= bucket.perDay.resetAt) {
        buckets.delete(key)
      }
    }
  }, 60_000)
}

function checkMemory(userId: string): RateLimitResult {
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

  return {
    allowed,
    remaining: {
      perMinute: Math.max(0, PER_MINUTE - bucket.perMinute.count),
      perDay: Math.max(0, PER_DAY - bucket.perDay.count),
    },
    retryAfterSeconds: allowed
      ? 0
      : Math.max(
          Math.ceil((bucket.perMinute.resetAt - now) / 1000),
          Math.ceil((bucket.perDay.resetAt - now) / 1000),
        ),
  }
}

/* ── Upstash-backed limiter ──────────────────────────────────────── */

let minuteLimiter: Ratelimit | null = null
let dayLimiter: Ratelimit | null = null

function getLimiters() {
  if (minuteLimiter) return { minuteLimiter, dayLimiter: dayLimiter! }

  const redis = getRedis()
  if (!redis) return null

  minuteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PER_MINUTE, "60 s"),
    analytics: false,
    prefix: "micuadre:mia:min",
  })
  dayLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(PER_DAY, "86400 s"),
    analytics: false,
    prefix: "micuadre:mia:day",
  })
  return { minuteLimiter, dayLimiter }
}

async function checkUpstash(userId: string): Promise<RateLimitResult> {
  const limiters = getLimiters()
  if (!limiters) return checkMemory(userId)

  const [minuteResult, dayResult] = await Promise.all([
    limiters.minuteLimiter.limit(userId),
    limiters.dayLimiter.limit(userId),
  ])

  const allowed = minuteResult.success && dayResult.success

  return {
    allowed,
    remaining: {
      perMinute: minuteResult.remaining,
      perDay: dayResult.remaining,
    },
    retryAfterSeconds: allowed
      ? 0
      : Math.max(
          minuteResult.success
            ? 0
            : Math.ceil((minuteResult.reset - Date.now()) / 1000),
          dayResult.success
            ? 0
            : Math.ceil((dayResult.reset - Date.now()) / 1000),
        ),
  }
}

/* ── Public API ──────────────────────────────────────────────────── */

export async function checkRateLimit(userId: string): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis) return checkMemory(userId)
  return checkUpstash(userId)
}

export const MIA_RATE_LIMITED_RESPONSE = {
  error: "Too Many Requests",
  message:
    "Estas haciendo muchas preguntas seguidas. Tómate un respiro e intentalo de nuevo en un minuto.",
  requiresUpgrade: false,
} as const
