/**
 * Cache Headers Utility
 * 
 * Provides utilities for setting appropriate cache headers on API responses
 * based on data type and user context.
 */

import { NextResponse } from 'next/server';

export type CacheStrategy = 
  | 'public-static'      // Public static data (default styles, palettes)
  | 'public-semi-static' // Public semi-static data (public thumbnails, styles)
  | 'private-user'       // User-specific data (user thumbnails, faces)
  | 'private-dynamic'    // User-specific dynamic data (notifications)
  | 'no-cache';          // Dynamic data that should never be cached

export interface CacheOptions {
  strategy: CacheStrategy;
  maxAge?: number; // Override default max-age in seconds
  staleWhileRevalidate?: number; // Stale-while-revalidate in seconds
  mustRevalidate?: boolean; // Add must-revalidate directive
}

/**
 * Get cache control header value based on strategy
 */
export function getCacheControlHeader(options: CacheOptions): string {
  const {
    strategy,
    maxAge,
    staleWhileRevalidate,
    mustRevalidate = false,
  } = options;

  const directives: string[] = [];

  switch (strategy) {
    case 'public-static':
      // Public static data: cache for 1 hour, allow stale for 1 day
      directives.push('public');
      directives.push(`max-age=${maxAge ?? 3600}`);
      if (staleWhileRevalidate !== undefined) {
        directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
      } else {
        directives.push('stale-while-revalidate=86400'); // 24 hours
      }
      break;

    case 'public-semi-static':
      // Public semi-static data: cache for 1 hour, allow stale for 6 hours
      directives.push('public');
      directives.push(`max-age=${maxAge ?? 3600}`);
      if (staleWhileRevalidate !== undefined) {
        directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
      } else {
        directives.push('stale-while-revalidate=21600'); // 6 hours
      }
      break;

    case 'private-user':
      // User-specific data: cache for 5 minutes, allow stale for 1 hour
      directives.push('private');
      directives.push(`max-age=${maxAge ?? 300}`);
      if (staleWhileRevalidate !== undefined) {
        directives.push(`stale-while-revalidate=${staleWhileRevalidate}`);
      } else {
        directives.push('stale-while-revalidate=3600'); // 1 hour
      }
      break;

    case 'private-dynamic':
      // User-specific dynamic data: cache for 2 minutes, must revalidate
      directives.push('private');
      directives.push(`max-age=${maxAge ?? 120}`);
      directives.push('must-revalidate');
      break;

    case 'no-cache':
      // No caching
      directives.push('no-cache');
      directives.push('no-store');
      directives.push('must-revalidate');
      break;
  }

  if (mustRevalidate && !directives.includes('must-revalidate')) {
    directives.push('must-revalidate');
  }

  return directives.join(', ');
}

/**
 * Generate ETag from response data
 */
export function generateETag(data: unknown): string {
  // Create a hash of the data
  const dataString = JSON.stringify(data);
  // Simple hash function (for production, consider using crypto.createHash)
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    const char = dataString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `"${Math.abs(hash).toString(16)}"`;
}

/**
 * Check if request has matching ETag (304 Not Modified)
 */
export function checkETag(request: Request, etag: string): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * Add cache headers to NextResponse
 */
export function addCacheHeaders(
  response: NextResponse,
  options: CacheOptions,
  etag?: string
): NextResponse {
  // Set Cache-Control header
  response.headers.set('Cache-Control', getCacheControlHeader(options));

  // Set ETag if provided
  if (etag) {
    response.headers.set('ETag', etag);
  }

  // Set Vary header for user-specific data
  if (options.strategy === 'private-user' || options.strategy === 'private-dynamic') {
    response.headers.set('Vary', 'Cookie, Authorization');
  } else if (options.strategy === 'public-semi-static' || options.strategy === 'public-static') {
    response.headers.set('Vary', 'Accept');
  }

  return response;
}

/**
 * Create a cached response with ETag support
 */
export function createCachedResponse(
  data: unknown,
  options: CacheOptions,
  request?: Request
): NextResponse {
  const etag = generateETag(data);

  // Check if client has cached version
  if (request && checkETag(request, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': getCacheControlHeader(options),
      },
    });
  }

  // Create response with cache headers
  const response = NextResponse.json(data);
  return addCacheHeaders(response, options, etag);
}
