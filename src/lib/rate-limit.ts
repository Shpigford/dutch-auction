import { LRUCache } from 'lru-cache'

export interface RateLimitOptions {
  interval: number // milliseconds
  uniqueTokenPerInterval: number
}

export interface RateLimit {
  check: (limit: number, token: string) => Promise<void>
}

export function rateLimit({ interval, uniqueTokenPerInterval }: RateLimitOptions): RateLimit {
  const tokenCache = new LRUCache({
    max: uniqueTokenPerInterval,
    ttl: interval
  })

  return {
    check: (limit: number, token: string) => {
      const tokenCount = (tokenCache.get(token) as number[]) || [0]
      if (tokenCount[0] === 0) {
        tokenCache.set(token, [1])
      }
      tokenCount[0] += 1

      const currentUsage = tokenCount[0]
      if (currentUsage > limit) {
        return Promise.reject(new Error('Rate limit exceeded'))
      }

      return Promise.resolve()
    }
  }
} 