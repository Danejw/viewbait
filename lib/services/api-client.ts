/**
 * API Client Utility
 * 
 * Centralized fetch wrapper for service layer.
 * Handles errors, provides consistent error format.
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

/**
 * Base API request function
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      let errorData: { error?: string; code?: string } = {}
      try {
        errorData = await response.json()
      } catch {
        // If response is not JSON, use status text
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
    return {
      data,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    }
  }
}

/**
 * GET request
 */
export async function apiGet<T>(
  path: string,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, {
    ...options,
    method: 'GET',
  })
}

/**
 * POST request
 */
export async function apiPost<T>(
  path: string,
  body?: unknown,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * PATCH request
 */
export async function apiPatch<T>(
  path: string,
  body?: unknown,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  return apiRequest<T>(path, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * DELETE request
 */
export async function apiDelete<T>(
  path: string,
  params?: Record<string, string>,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  // Construct URL with query parameters if provided
  let url = path
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams(params)
    url = `${path}?${searchParams.toString()}`
  }

  return apiRequest<T>(url, {
    ...options,
    method: 'DELETE',
  })
}

/**
 * POST request with FormData (for file uploads)
 */
export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(path, {
      ...options,
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
      headers: {
        ...options.headers,
      },
    })

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
    return {
      data,
      error: null,
    }
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR',
      },
    }
  }
}
