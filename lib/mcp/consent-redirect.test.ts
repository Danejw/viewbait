import { describe, expect, it } from 'vitest'
import { buildOAuthConsentAuthRedirect } from '@/lib/mcp/consent-redirect'

describe('buildOAuthConsentAuthRedirect', () => {
  it('returns auth redirect with relative consent return path', () => {
    expect(buildOAuthConsentAuthRedirect('auth-req-1')).toBe(
      '/auth?redirect=%2Foauth%2Fconsent%3Fauthorization_id%3Dauth-req-1',
    )
  })

  it('encodes authorization ids safely', () => {
    expect(buildOAuthConsentAuthRedirect('a/b c')).toContain(
      encodeURIComponent('/oauth/consent?authorization_id=a%2Fb%20c'),
    )
  })
})
