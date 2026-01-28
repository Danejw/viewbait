/**
 * Retry Utility with Exponential Backoff
 * 
 * Handles retry logic for API calls with exponential backoff strategy.
 * Specifically designed for handling rate limit (429) responses.
 * Supports timeout to prevent indefinite hangs.
 */

/**
 * Custom error class for timeout errors
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Options for retry with backoff
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number
  /** Initial delay in milliseconds (default: 1000ms = 1s) */
  initialDelayMs?: number
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number
  /** Custom function to determine if an error should be retried (default: retries on 429) */
  shouldRetry?: (response: Response) => boolean
  /** Timeout in milliseconds for the entire retry sequence (default: no timeout) */
  timeoutMs?: number
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (response: Response) => response.status === 429,
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a fetch call with exponential backoff
 * 
 * @param fetchFn - Function that returns a Promise<Response>
 * @param options - Retry configuration options
 * @returns Promise<Response> - The successful response
 * @throws Error if all retries are exhausted
 * @throws TimeoutError if timeout is exceeded
 * 
 * @example
 * ```ts
 * const response = await retryWithBackoff(
 *   () => fetch(url, options),
 *   { maxRetries: 3, timeoutMs: 60000 }
 * )
 * ```
 */
export async function retryWithBackoff(
  fetchFn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  const config = { ...DEFAULT_OPTIONS, ...options }
  let delay = config.initialDelayMs
  const startTime = Date.now()

  // Helper to check if timeout has been exceeded
  const checkTimeout = (): void => {
    if (config.timeoutMs !== undefined) {
      const elapsed = Date.now() - startTime
      if (elapsed >= config.timeoutMs) {
        throw new TimeoutError(
          `Request timed out after ${config.timeoutMs}ms (elapsed: ${elapsed}ms)`
        )
      }
    }
  }

  // Helper to wrap fetchFn with timeout using Promise.race
  const fetchWithTimeout = async (): Promise<Response> => {
    if (config.timeoutMs === undefined) {
      return fetchFn()
    }

    const elapsed = Date.now() - startTime
    const remainingTime = config.timeoutMs - elapsed

    if (remainingTime <= 0) {
      throw new TimeoutError(
        `Request timed out after ${config.timeoutMs}ms (elapsed: ${elapsed}ms)`
      )
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const finalElapsed = Date.now() - startTime
        reject(
          new TimeoutError(
            `Request timed out after ${config.timeoutMs}ms (elapsed: ${finalElapsed}ms)`
          )
        )
      }, remainingTime)
    })

    return Promise.race([fetchFn(), timeoutPromise])
  }

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    // Check timeout before each attempt
    checkTimeout()

    try {
      const response = await fetchWithTimeout()

      // If response is successful, return it
      if (response.ok) {
        return response
      }

      // Check if we should retry this error
      if (config.shouldRetry(response)) {
        // If this is the last attempt, throw the error
        if (attempt === config.maxRetries) {
          const errorText = await response.text().catch(() => 'Unknown error')
          throw new Error(`Rate limit error after ${config.maxRetries + 1} attempts: ${response.status} - ${errorText}`)
        }

        // Check timeout before waiting
        checkTimeout()

        // Calculate remaining time for delay
        if (config.timeoutMs !== undefined) {
          const elapsed = Date.now() - startTime
          const remainingTime = config.timeoutMs - elapsed
          if (remainingTime <= 0) {
            throw new TimeoutError(
              `Request timed out after ${config.timeoutMs}ms (elapsed: ${elapsed}ms)`
            )
          }
          // Use minimum of calculated delay and remaining time
          const actualDelay = Math.min(delay, remainingTime)
          await sleep(actualDelay)
        } else {
          await sleep(delay)
        }

        // Check timeout after delay
        checkTimeout()

        // Calculate next delay with exponential backoff
        delay *= config.backoffMultiplier

        // Continue to next iteration (retry)
        continue
      }

      // Non-retryable error - throw immediately
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API error: ${response.status} - ${errorText}`)
    } catch (error) {
      // Handle timeout errors
      if (error instanceof TimeoutError) {
        throw error
      }

      // If it's a network error or other non-Response error, throw immediately
      // (we only retry on 429 status codes, which are Response objects)
      if (!(error instanceof Error && error.message.includes('Rate limit error'))) {
        throw error
      }

      // This is a rate limit error that we threw ourselves
      // If this is the last attempt, re-throw it
      if (attempt === config.maxRetries) {
        throw error
      }

      // Check timeout before continuing
      checkTimeout()

      // Otherwise, we've already waited and incremented delay in the try block
      // This catch is mainly for handling the case where response.text() throws
      // But in practice, we should have already handled the retry logic above
      continue
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Retry failed: Unknown error')
}
