/**
 * Public MCP endpoint helpers for docs and client connection guides.
 * Always prefer the www host: apex 307 redirects break OAuth discovery.
 */

/** Canonical Streamable HTTP endpoint for ViewBait MCP clients. */
export const VIEWBAIT_MCP_ENDPOINT = 'https://www.viewbait.app/api/mcp' as const

/**
 * Trims whitespace and removes a single trailing slash from an MCP URL.
 */
export function normalizeMcpEndpointInput(input: string): string {
  return input.trim().replace(/\/+$/, '')
}

/**
 * Returns true when the value matches the canonical www MCP endpoint.
 * Apex (`viewbait.app`) and query strings are rejected because they break OAuth.
 */
export function isCanonicalViewbaitMcpEndpoint(input: string): boolean {
  return normalizeMcpEndpointInput(input) === VIEWBAIT_MCP_ENDPOINT
}

/**
 * Cursor `mcp.json` snippet for remote ViewBait MCP (OAuth handled by the client).
 */
export function buildCursorMcpConfigSnippet(): string {
  return JSON.stringify(
    {
      mcpServers: {
        viewbait: {
          url: VIEWBAIT_MCP_ENDPOINT,
        },
      },
    },
    null,
    2,
  )
}
