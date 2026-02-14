/**
 * Client-side fetch with optional timeout.
 * Uses AbortSignal.timeout(ms) so long-running or stuck requests fail fast.
 * Do not use for streaming responses (e.g. assistant/agent chat).
 */

export const DEFAULT_LIST_DETAIL_TIMEOUT_MS = 30_000;
export const DEFAULT_LONG_OP_TIMEOUT_MS = 60_000;

export interface FetchWithTimeoutOptions extends Omit<RequestInit, 'signal'> {
  /** Timeout in ms. Omit for no timeout. */
  timeoutMs?: number;
}

/**
 * Fetch with optional timeout. Rejects with DOMException (AbortError) or Error on timeout.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs, ...init } = options;
  if (timeoutMs == null || timeoutMs <= 0) {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}
