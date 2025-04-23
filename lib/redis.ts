import { Redis } from '@upstash/redis'
import { Ratelimit } from '@upstash/ratelimit'
import { CONFIG } from './config'

// Only initialize Redis if rate limiting is enabled
export const redis = CONFIG.rateLimits.enabled 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || '',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null

// Create dummy rate limiters that always succeed when rate limiting is disabled
const createDummyRatelimit = () => ({
  limit: async () => ({ success: true })
})

// Initialize rate limiters based on config
export const searchRatelimit = CONFIG.rateLimits.enabled
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CONFIG.rateLimits.search, '1 m'),
    })
  : createDummyRatelimit()

export const fetchContentRatelimit = CONFIG.rateLimits.enabled
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CONFIG.rateLimits.contentFetch, '1 m'),
    })
  : createDummyRatelimit()

export const reportContentRatelimit = CONFIG.rateLimits.enabled
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(CONFIG.rateLimits.reportGeneration, '1 m'),
    })
  : createDummyRatelimit()
