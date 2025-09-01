/**
 * Retry helper for handling API rate limiting and transient errors
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
}

export interface RetryableError {
  isRetryable: boolean
  retryAfter?: number // seconds to wait before retrying
}

export function isRetryableGraphQLError(error: any): RetryableError {
  // Handle GraphQL rate limiting errors from Buildkite API
  if (
    error?.graphQLErrors?.some((e: any) =>
      e.message?.includes("exceeded the limit") ||
      e.message?.includes("rate limit")
    )
  ) {
    // Try to extract retry-after from error message
    const retryMatch = error.graphQLErrors[0]?.message?.match(/try again in (\d+) seconds/)
    let retryAfter = retryMatch ? parseInt(retryMatch[1]) : null

    // Check for ratelimit-reset header in response (preferred method)
    if (error?.response?.headers) {
      const rateLimitReset = error.response.headers.get("ratelimit-reset")
      if (rateLimitReset) {
        const resetSeconds = parseInt(rateLimitReset)
        if (!isNaN(resetSeconds)) {
          retryAfter = resetSeconds
        }
      }
    }

    const finalRetryAfter = retryAfter || 60
    console.log(`🚦 Rate limit detected: ${error.graphQLErrors[0]?.message}`)
    // Log rate limit info for debugging
    if (error?.response?.headers) {
      const rateLimitHeaders: Record<string, string> = {}
      for (const [key, value] of error.response.headers.entries()) {
        if (key.includes("rate")) {
          rateLimitHeaders[key] = value
        }
      }
      console.log(`📊 Rate limit headers:`, rateLimitHeaders)
    }
    console.log(`⏰ Will retry after ${finalRetryAfter} seconds`)

    return {
      isRetryable: true,
      retryAfter: finalRetryAfter,
    }
  }

  // Handle network errors (including 429 Too Many Requests)
  if (error?.networkError || error?.response?.status === 429) {
    const response = error?.response || error?.networkError
    const statusCode = response?.status || error?.networkError?.statusCode

    if (statusCode === 429 || statusCode === 409 || statusCode >= 500) {
      // Check for rate limit headers
      let retryAfter = 30 // default fallback

      if (response?.headers) {
        const rateLimitReset = response.headers.get("ratelimit-reset")
        const retryAfterHeader = response.headers.get("retry-after")

        if (rateLimitReset) {
          const resetSeconds = parseInt(rateLimitReset)
          if (!isNaN(resetSeconds)) {
            retryAfter = resetSeconds
          }
        } else if (retryAfterHeader) {
          const afterSeconds = parseInt(retryAfterHeader)
          if (!isNaN(afterSeconds)) {
            retryAfter = afterSeconds
          }
        }
      }

      return { isRetryable: true, retryAfter }
    }
  }

  return { isRetryable: false }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 60000,
    backoffMultiplier = 2,
  } = options

  let lastError: any
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) {
        break // Final attempt, don't retry
      }

      const retryInfo = isRetryableGraphQLError(error)
      if (!retryInfo.isRetryable) {
        throw error // Not retryable, fail immediately
      }

      // Use rate limit retry-after if available, otherwise use exponential backoff
      const waitTime = retryInfo.retryAfter ? retryInfo.retryAfter * 1000 : Math.min(delay, maxDelay)

      if (retryInfo.retryAfter) {
        console.log(
          `🚦 Rate limited. Waiting ${retryInfo.retryAfter} seconds before retry (attempt ${attempt + 1}/${
            maxRetries + 1
          })`,
        )
      } else {
        console.log(`🔄 Retrying operation in ${waitTime}ms (attempt ${attempt + 1}/${maxRetries + 1})`)
      }

      await new Promise((resolve) => setTimeout(resolve, waitTime))

      // Exponential backoff for next attempt (if not using rate limit delay)
      if (!retryInfo.retryAfter) {
        delay = Math.min(delay * backoffMultiplier, maxDelay)
      }
    }
  }

  throw lastError
}

/**
 * Simple cache to avoid repeated API calls during development
 */
class SimpleCache<T> {
  private cache = new Map<string, { value: T; expiry: number }>()

  set(key: string, value: T, ttlSeconds: number = 300) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000),
    })
  }

  get(key: string): T | null {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  clear() {
    this.cache.clear()
  }
}

export const apiCache = new SimpleCache()
