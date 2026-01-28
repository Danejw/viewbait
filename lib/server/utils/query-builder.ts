/**
 * Query Builder Utility
 * 
 * Reusable helpers for building Supabase queries with consistent patterns.
 * Supports pagination (offset and cursor-based), filtering, and ordering.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface CursorPaginationOptions {
  limit: number
  cursor?: string | null
  orderBy: string
  orderDirection: 'asc' | 'desc'
  /**
   * Cursor column to use when orderBy is not the cursor column
   * Defaults to 'id' for tie-breaking
   */
  cursorColumn?: string
}

export interface OrderOptions {
  column: string
  ascending?: boolean
}

export interface QueryBuilderOptions {
  pagination?: PaginationOptions
  cursorPagination?: CursorPaginationOptions
  order?: OrderOptions
  count?: boolean
  /**
   * Custom field selection (defaults to '*')
   */
  select?: string
}

/**
 * Apply offset-based pagination to a query
 */
export function applyPagination(
  query: ReturnType<SupabaseClient['from']>['select'],
  options: PaginationOptions = {}
): ReturnType<SupabaseClient['from']>['select'] {
  const { limit = 20, offset = 0 } = options
  return query.range(offset, offset + limit - 1)
}

/**
 * Apply cursor-based pagination to a query
 * 
 * Cursor pagination filters results based on a cursor value and order direction.
 * For orderBy='created_at', uses created_at as cursor. For other orderBy values,
 * uses cursorColumn (defaults to 'id') as cursor.
 */
export function applyCursorPagination(
  query: ReturnType<SupabaseClient['from']>['select'],
  options: CursorPaginationOptions
): ReturnType<SupabaseClient['from']>['select'] {
  const {
    limit,
    cursor,
    orderBy,
    orderDirection,
    cursorColumn = 'id',
  } = options

  let paginatedQuery = query

  // Apply cursor filter if cursor is provided
  if (cursor) {
    if (orderBy === 'created_at' || orderBy === cursorColumn) {
      // Use orderBy column as cursor
      if (orderDirection === 'desc') {
        paginatedQuery = paginatedQuery.lt(orderBy, cursor)
      } else {
        paginatedQuery = paginatedQuery.gt(orderBy, cursor)
      }
    } else {
      // Use cursorColumn (typically 'id') as cursor for tie-breaking
      paginatedQuery = paginatedQuery.lt(cursorColumn, cursor)
    }
  }

  // Apply limit (typically limit + 1 to check for next page)
  paginatedQuery = paginatedQuery.limit(limit)

  return paginatedQuery
}

/**
 * Apply ordering to a query
 */
export function applyOrder(
  query: ReturnType<SupabaseClient['from']>['select'],
  options: OrderOptions
): ReturnType<SupabaseClient['from']>['select'] {
  const { column, ascending = false } = options
  return query.order(column, { ascending })
}

/**
 * Build a paginated query with ordering
 * Supports both offset-based and cursor-based pagination
 */
export function buildPaginatedQuery(
  query: ReturnType<SupabaseClient['from']>['select'],
  options: QueryBuilderOptions = {}
): ReturnType<SupabaseClient['from']>['select'] {
  let builtQuery = query

  if (options.order) {
    builtQuery = applyOrder(builtQuery, options.order)
  }

  // Cursor pagination takes precedence over offset pagination
  if (options.cursorPagination) {
    builtQuery = applyCursorPagination(builtQuery, options.cursorPagination)
  } else if (options.pagination) {
    builtQuery = applyPagination(builtQuery, options.pagination)
  }

  return builtQuery
}

/**
 * Common query patterns
 */
export const QueryPatterns = {
  /**
   * User-owned items query
   * 
   * @param supabase - Supabase client instance
   * @param table - Table name
   * @param userId - User ID to filter by
   * @param options - Query builder options (pagination, ordering, field selection)
   * @returns Query builder (not executed)
   */
  userOwned: (
    supabase: SupabaseClient,
    table: string,
    userId: string,
    options: QueryBuilderOptions = {}
  ) => {
    const selectFields = options.select || '*'
    const query = supabase
      .from(table)
      .select(selectFields, options.count ? { count: 'exact' } : undefined)
      .eq('user_id', userId)

    return buildPaginatedQuery(query, options)
  },

  /**
   * User-owned items with favorites filter
   * 
   * @param supabase - Supabase client instance
   * @param table - Table name
   * @param userId - User ID to filter by
   * @param favoritesOnly - Whether to filter by favorites only
   * @param options - Query builder options (pagination, ordering, field selection)
   * @returns Query builder (not executed)
   */
  userOwnedWithFavorites: (
    supabase: SupabaseClient,
    table: string,
    userId: string,
    favoritesOnly: boolean,
    options: QueryBuilderOptions = {}
  ) => {
    const selectFields = options.select || '*'
    let query = supabase
      .from(table)
      .select(selectFields, options.count ? { count: 'exact' } : undefined)
      .eq('user_id', userId)

    if (favoritesOnly) {
      query = query.eq('liked', true)
    }

    return buildPaginatedQuery(query, options)
  },
}
