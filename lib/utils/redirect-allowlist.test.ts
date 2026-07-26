import { describe, expect, it } from 'vitest'
import { getAllowedRedirect, isAllowedRedirect } from '@/lib/utils/redirect-allowlist'

describe('redirect allowlist', () => {
  it('allows oauth consent return path with authorization_id query', () => {
    const path = '/oauth/consent?authorization_id=abc-123'
    expect(isAllowedRedirect(path)).toBe(true)
    expect(getAllowedRedirect(path)).toBe(path)
  })

  it('rejects absolute consent urls to prevent open redirects', () => {
    expect(isAllowedRedirect('https://viewbait.app/oauth/consent?authorization_id=abc')).toBe(
      false,
    )
  })

  it('falls back when redirect is missing or disallowed', () => {
    expect(getAllowedRedirect(null)).toBe('/studio')
    expect(getAllowedRedirect('/admin')).toBe('/studio')
  })
})
