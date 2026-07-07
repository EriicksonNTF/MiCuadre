import "server-only"

import { Ratelimit } from "@upstash/ratelimit"
import { getRedis } from "@/lib/upstash"

type RateLimitConfig = {
  maxRequests: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

/* ── In-memory fallback (when Upstash is not configured) ─────────── */

type TokenBucketEntry = { count: number; resetAt: number }
const memoryStores = new Map<string, TokenBucketEntry>()

// Periodic cleanup of expired entries to prevent memory leak
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of memoryStores) {
      if (now >= entry.resetAt) memoryStores.delete(key)
    }
  }, 60_000)
}

function createMemoryLimiter(config: RateLimitConfig) {
  return function check(key: string): RateLimitResult {
    const now = Date.now()
    let entry = memoryStores.get(key)
    if (entry && now >= entry.resetAt) {
      memoryStores.delete(key)
      entry = undefined
    }
    if (!entry) {
      entry = { count: 0, resetAt: now + config.windowMs }
      memoryStores.set(key, entry)
    }
    entry.count += 1
    const allowed = entry.count <= config.maxRequests
    return {
      allowed,
      retryAfterSeconds: allowed
        ? 0
        : Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      remaining: Math.max(0, config.maxRequests - entry.count),
    }
  }
}

/* ── Upstash-backed limiter ──────────────────────────────────────── */

function createUpstashLimiter(config: RateLimitConfig) {
  const redis = getRedis()
  if (!redis) return createMemoryLimiter(config)

  const windowSeconds = Math.ceil(config.windowMs / 1000)
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, `${windowSeconds} s`),
    analytics: false,
    prefix: "micuadre:rl",
  })

  return async function check(key: string): Promise<RateLimitResult> {
    const result = await limiter.limit(key)
    return {
      allowed: result.success,
      retryAfterSeconds: result.success
        ? 0
        : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      remaining: result.remaining,
    }
  }
}

function createNoopLimiter() {
  return function check(_key: string): RateLimitResult {
    return { allowed: true, retryAfterSeconds: 0, remaining: Infinity }
  }
}

/* ── Public API ──────────────────────────────────────────────────── */

export function createRateLimiter(config: RateLimitConfig) {
  if (config.maxRequests <= 0) return createNoopLimiter()
  return createUpstashLimiter(config)
}

export const API_RATE_LIMIT = {
  mia: createRateLimiter({
    maxRequests: Number(process.env.MIA_RATE_LIMIT_PER_MINUTE) || 15,
    windowMs: 60_000,
  }),
  coach: createRateLimiter({
    maxRequests: Number(process.env.COACH_RATE_LIMIT_PER_MINUTE) || 20,
    windowMs: 60_000,
  }),
  billing: createRateLimiter({
    maxRequests: 10,
    windowMs: 60_000,
  }),
  general: createRateLimiter({
    maxRequests: 30,
    windowMs: 60_000,
  }),
  ocr: createRateLimiter({
    maxRequests: Number(process.env.OCR_RATE_LIMIT_PER_MINUTE) || 10,
    windowMs: 60_000,
  }),
}
