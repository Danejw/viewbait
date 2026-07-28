import { describe, expect, it } from 'vitest'
import {
  VIEWBAIT_MCP_ENDPOINT,
  buildCursorMcpConfigSnippet,
  isCanonicalViewbaitMcpEndpoint,
  normalizeMcpEndpointInput,
} from '@/lib/mcp/public-endpoint'

describe('VIEWBAIT_MCP_ENDPOINT', () => {
  it('uses the www host without a trailing slash', () => {
    expect(VIEWBAIT_MCP_ENDPOINT).toBe('https://www.viewbait.app/api/mcp')
  })
})

describe('normalizeMcpEndpointInput', () => {
  it('trims whitespace and strips a trailing slash', () => {
    expect(normalizeMcpEndpointInput('  https://www.viewbait.app/api/mcp/  ')).toBe(
      'https://www.viewbait.app/api/mcp',
    )
  })
})

describe('isCanonicalViewbaitMcpEndpoint', () => {
  it('accepts the canonical www endpoint', () => {
    expect(isCanonicalViewbaitMcpEndpoint('https://www.viewbait.app/api/mcp')).toBe(true)
    expect(isCanonicalViewbaitMcpEndpoint('https://www.viewbait.app/api/mcp/')).toBe(true)
  })

  it('rejects apex and malformed hosts that break OAuth', () => {
    expect(isCanonicalViewbaitMcpEndpoint('https://viewbait.app/api/mcp')).toBe(false)
    expect(isCanonicalViewbaitMcpEndpoint('http://www.viewbait.app/api/mcp')).toBe(false)
    expect(isCanonicalViewbaitMcpEndpoint('https://www.viewbait.app/api/mcp?x=1')).toBe(false)
  })
})

describe('buildCursorMcpConfigSnippet', () => {
  it('returns a json snippet pointing at the canonical endpoint', () => {
    const snippet = buildCursorMcpConfigSnippet()
    expect(snippet).toContain('"url": "https://www.viewbait.app/api/mcp"')
    expect(snippet).toContain('"viewbait"')
  })
})
