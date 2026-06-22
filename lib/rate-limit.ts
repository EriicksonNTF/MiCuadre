import "server-only"

type RateLimitConfig = {
  maxRequests: number
  windowMs: number
}

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
  remaining: number
}

type TokenBucketEntry = {
  count: number
  resetAt: number
}

const stores = new Map<string, TokenBucketEntry>()

function createMemoryLimiter(config: RateLimitConfig) {
  return function check(key: string): RateLimitResult {
    const now = Date.now()

    let entry = stores.get(key)
    if (entry && now >= entry.resetAt) {
      stores.delete(key)
      entry = undefined
    }

    if (!entry) {
      entry = { count: 0, resetAt: now + config.windowMs }
      stores.set(key, entry)
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

function createNoopLimiter() {
  return function check(_key: string): RateLimitResult {
    return { allowed: true, retryAfterSeconds: 0, remaining: Infinity }
  }
}

export function createRateLimiter(config: RateLimitConfig) {
  if (config.maxRequests <= 0) return createNoopLimiter()
  return createMemoryLimiter(config)
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
