/**
 * API Helpers Utility
 * 
 * Shared functions for API routes to reduce code duplication and ensure
 * consistent API responses across all endpoints.
 */

import { NextResponse } from 'next/server'
import { logError } from './logger'
import {
  validationErrorResponse,
  serverErrorResponse,
  storageErrorResponse,
} from './error-handler'

/**
 * Query parameters interface for common pagination and sorting
 */
export interface QueryParams {
  limit: number
  offset: number
  cursor: string | null
  orderBy: string
  orderDirection: 'asc' | 'desc'
}

/**
 * Options for parseQueryParams
 */
export interface ParseQueryParamsOptions {
  defaultLimit?: number
  maxLimit?: number
  defaultOffset?: number
  defaultOrderBy?: string
  defaultOrderDirection?: 'asc' | 'desc'
  allowedOrderBy?: string[]
}

/**
 * Parses and validates common query parameters from a Request
 * @param request - The incoming Request object
 * @param options - Optional configuration for defaults and validation
 * @returns Parsed and validated query parameters
 */
export function parseQueryParams(
  request: Request,
  options: ParseQueryParamsOptions = {}
): QueryParams {
  const {
    defaultLimit = 20,
    maxLimit = 100,
    defaultOffset = 0,
    defaultOrderBy = 'created_at',
    defaultOrderDirection = 'desc',
    allowedOrderBy,
  } = options

  const { searchParams } = new URL(request.url)

  // Parse limit with validation
  const limitParam = searchParams.get('limit')
  let limit = defaultLimit
  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, maxLimit) // Enforce max limit
    } else {
      // Invalid limit value - could throw or use default
      // For now, we'll use default to be lenient
    }
  }

  // Parse offset with validation
  const offsetParam = searchParams.get('offset')
  let offset = defaultOffset
  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10)
    if (!isNaN(parsed) && parsed >= 0) {
      offset = parsed
    }
  }

  // Parse cursor (string or null)
  const cursor = searchParams.get('cursor')

  // Parse orderBy with validation
  const orderByParam = searchParams.get('orderBy')
  let orderBy = defaultOrderBy
  if (orderByParam) {
    if (allowedOrderBy && !allowedOrderBy.includes(orderByParam)) {
      // Invalid orderBy - use default
      orderBy = defaultOrderBy
    } else {
      orderBy = orderByParam
    }
  }

  // Parse orderDirection with validation
  const orderDirectionParam = searchParams.get('orderDirection')
  let orderDirection: 'asc' | 'desc' = defaultOrderDirection
  if (orderDirectionParam) {
    const normalized = orderDirectionParam.toLowerCase()
    if (normalized === 'asc' || normalized === 'desc') {
      orderDirection = normalized
    }
  }

  return {
    limit,
    offset,
    cursor,
    orderBy,
    orderDirection,
  }
}

/**
 * Paginated response data structure
 */
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  nextCursor?: string | null
  hasNextPage?: boolean
  offset?: number
  limit?: number
}

/**
 * Options for buildPaginatedResponse
 */
export interface BuildPaginatedResponseOptions {
  useCursor?: boolean
  includeOffset?: boolean
}

/**
 * Builds a standardized paginated response
 * @param data - The data array (may include one extra item for hasNextPage detection)
 * @param count - Total count of items (from database count)
 * @param limit - The limit used for this request
 * @param cursor - Optional cursor for cursor-based pagination
 * @param options - Configuration options
 * @returns Standardized paginated response object
 */
export function buildPaginatedResponse<T>(
  data: T[],
  count: number | null,
  limit: number,
  cursor: string | null = null,
  options: BuildPaginatedResponseOptions = {}
): PaginatedResponse<T> {
  const { useCursor = false, includeOffset = false } = options

  // For cursor-based pagination, check if we fetched limit + 1
  if (useCursor && cursor !== undefined) {
    const hasNextPage = data.length > limit
    const actualData = hasNextPage ? data.slice(0, limit) : data

    // Get next cursor from last item if there's a next page
    let nextCursor: string | null = null
    if (hasNextPage && actualData.length > 0) {
      // The caller should provide the cursor value from the last item
      // This is a simplified version - actual implementation may need
      // the orderBy field to determine which field to use as cursor
      nextCursor = null // Will be set by caller
    }

    return {
      data: actualData,
      count: count || 0,
      nextCursor: hasNextPage ? nextCursor : null,
      hasNextPage,
      ...(includeOffset && { limit }),
    }
  }

  // For offset-based pagination
  return {
    data,
    count: count || 0,
    ...(includeOffset && { offset: 0, limit }), // Offset would need to be passed in
  }
}

/**
 * Builds a cursor-based paginated response with automatic cursor extraction
 * @param data - The data array (may include one extra item for hasNextPage detection)
 * @param count - Total count of items (from database count)
 * @param limit - The limit used for this request
 * @param orderBy - The field used for ordering (to extract cursor from)
 * @returns Standardized paginated response with cursor
 */
export function buildCursorPaginatedResponse<T extends Record<string, unknown>>(
  data: T[],
  count: number | null,
  limit: number,
  orderBy: string = 'created_at'
): PaginatedResponse<T> {
  const hasNextPage = data.length > limit
  const actualData = hasNextPage ? data.slice(0, limit) : data

  // Extract cursor from last item
  let nextCursor: string | null = null
  if (hasNextPage && actualData.length > 0) {
    const lastItem = actualData[actualData.length - 1]
    // Use orderBy field as cursor, fallback to id
    if (orderBy === 'created_at' && lastItem.created_at) {
      nextCursor = String(lastItem.created_at)
    } else if (lastItem.id) {
      nextCursor = String(lastItem.id)
    } else if (lastItem[orderBy]) {
      nextCursor = String(lastItem[orderBy])
    }
  }

  return {
    data: actualData,
    count: count || 0,
    nextCursor: hasNextPage ? nextCursor : null,
    hasNextPage,
  }
}

/**
 * Handles API errors with centralized logging and response formatting
 * @param error - The error that occurred
 * @param route - The route identifier (e.g., 'GET /api/thumbnails')
 * @param operation - The operation identifier (e.g., 'fetch-thumbnails')
 * @param userId - Optional user ID for logging context
 * @param defaultMessage - Default error message if error cannot be extracted
 * @returns NextResponse with appropriate error status
 */
export function handleApiError(
  error: unknown,
  route: string,
  operation: string,
  userId?: string,
  defaultMessage: string = 'An error occurred'
): NextResponse {
  // requireAuth throws NextResponse, so check if it's already a response
  if (error instanceof NextResponse) {
    return error
  }

  // Log error with context
  logError(error, {
    route,
    userId,
    operation,
  })

  // Return standardized error response
  return serverErrorResponse(error, defaultMessage, {
    route,
    userId,
  })
}

/**
 * Handles API errors for storage routes (uses storageErrorResponse).
 * Same as handleApiError but returns storageErrorResponse for storage-specific logging/code.
 */
export function handleStorageApiError(
  error: unknown,
  route: string,
  operation: string,
  userId?: string,
  defaultMessage: string = 'Storage operation failed'
): NextResponse {
  if (error instanceof NextResponse) {
    return error
  }
  logError(error, { route, userId, operation })
  return storageErrorResponse(error, defaultMessage, { route, userId })
}
