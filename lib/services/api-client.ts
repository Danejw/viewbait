/**
 * API Client Utility
 *
 * Centralized fetch wrapper for service layer.
 * Handles errors, timeout, optional retry (GET only), and consistent error format.
 */

export interface ApiError {
  message: string
  code?: string
  status?: number
}

export interface ApiResponse<T> {
  data: T | null
  error: ApiError | null
}

/** Per-call options: timeout and retry (GET only). */
export interface ApiRequestOptions {
  /** Request timeout in ms. Default 30_000. Set to 0 to disable. */
  timeoutMs?: number
  /** For GET: retry on 5xx or network error (default true). Ignored for non-GET. */
  retry?: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RETRIES = 2
const RETRY_DELAYS_MS = [1_000, 2_000]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Single attempt: fetch with timeout. Caller handles retries.
 */
async function fetchWithTimeout<T>(
  path: string,
  options: RequestInit & { signal?: AbortSignal },
  timeoutMs: number
): Promise<ApiResponse<T>> {
  const controller = new AbortController()
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined
  const signal =
    timeoutMs > 0 ? controller.signal : (options.signal ?? undefined)

  try {
    const response = await fetch(path, {
      ...options,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (timeoutId) clearTimeout(timeoutId)

    if (!response.ok) {
      let errorData: { error?: string; code?: string } = {}
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: response.statusText }
      }
      return {
        data: null,
        error: {
          message: errorData.error || 'Request failed',
          code: errorData.code || 'REQUEST_FAILED',
          status: response.status,
        },
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        return {
          data: null,
          error: { message: 'Request timeout', code: 'TIMEOUT' },
        }
      }
      return {
        data: null,
        error: {
          message: err.message,
          code: 'NETWORK_ERROR',
        },
      }
    }
    return {
      data: null,
      error: { message: 'Network error', code: 'NETWORK_ERROR' },
    }
  }
}

/**
 * Base API request: optional timeout and, for GET, optional retry on 5xx/network.
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  apiOptions: ApiRequestOptions & { method?: string } = {}
): Promise<ApiResponse<T>> {
  const timeoutMs = apiOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const retry = apiOptions.retry ?? false
  const method = (options.method ?? apiOptions.method ?? 'GET').toUpperCase()
  const isGet = method === 'GET'
  const shouldRetry = isGet && retry

  let lastResult: ApiResponse<T> = await fetchWithTimeout<T>(path, options, timeoutMs)

  if (!shouldRetry || lastResult.error === null) {
    return lastResult
  }

  const status = lastResult.error.status
  const code = lastResult.error.code
  const is5xx = typeof status === 'number' && status >= 500
  const isNetworkError = code === 'NETWORK_ERROR' || code === 'TIMEOUT'
  if (!is5xx && !isNetworkError) {
    return lastResult
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    await delay(RETRY_DELAYS_MS[attempt] ?? RETRY_DELAYS_MS[0])
    lastResult = await fetchWithTimeout<T>(path, options, timeoutMs)
    if (lastResult.error === null) return lastResult
    const retryStatus = lastResult.error.status
    const retryCode = lastResult.error.code
    if (typeof retryStatus === 'number' && retryStatus >= 400 && retryStatus < 500) {
      return lastResult
    }
    if (retryCode !== 'NETWORK_ERROR' && retryCode !== 'TIMEOUT' && (typeof retryStatus !== 'number' || retryStatus < 500)) {
      return lastResult
    }
  }

  return lastResult
}

/**
 * GET request. Uses default timeout (30s) and retry on 5xx/network (enabled by default).
 */
export async function apiGet<T>(
  path: string,
  options: Omit<RequestInit, 'method' | 'body'> = {},
  apiOptions: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { timeoutMs, retry = true } = apiOptions
  return apiRequest<T>(
    path,
    { ...options, method: 'GET' },
    { timeoutMs, retry, method: 'GET' }
  )
}

/**
 * POST request. Uses default timeout; no retry. Pass apiOptions to override timeout.
 */
export async function apiPost<T>(
  path: string,
  body?: unknown,
  options: Omit<RequestInit, 'method' | 'body'> = {},
  apiOptions: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(
    path,
    {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    },
    { ...apiOptions, retry: false }
  )
}

/**
 * PATCH request. Uses default timeout; no retry.
 */
export async function apiPatch<T>(
  path: string,
  body?: unknown,
  options: Omit<RequestInit, 'method' | 'body'> = {},
  apiOptions: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(
    path,
    {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    },
    { ...apiOptions, retry: false }
  )
}

/**
 * DELETE request. Uses default timeout; no retry.
 */
export async function apiDelete<T>(
  path: string,
  params?: Record<string, string>,
  options: Omit<RequestInit, 'method' | 'body'> = {},
  apiOptions: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  let url = path
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params)
    url = `${path}?${searchParams.toString()}`
  }
  return apiRequest<T>(url, { ...options, method: 'DELETE' }, { ...apiOptions, retry: false })
}

/**
 * POST request with FormData (for file uploads). Uses default timeout; no retry.
 */
export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, 'method' | 'body'> = {},
  apiOptions: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const timeoutMs = apiOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId =
    timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined

  try {
    const response = await fetch(path, {
      ...options,
      method: 'POST',
      body: formData,
      signal: controller.signal,
      headers: {
        ...options.headers,
      },
    })

    if (timeoutId) clearTimeout(timeoutId)

    if (!response.ok) {
      let errorData: { error?: string; code?: string } = {}
      try {
        errorData = await response.json()
      } catch {
        errorData = { error: response.statusText }
      }
      return {
        data: null,
        error: {
          message: errorData.error || 'Request failed',
          code: errorData.code || 'REQUEST_FAILED',
          status: response.status,
        },
      }
    }

    const data = await response.json()
    return { data, error: null }
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        data: null,
        error: { message: 'Request timeout', code: 'TIMEOUT' },
      }
    }
    return {
      data: null,
      error: {
        message: err instanceof Error ? err.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    }
  }
}
