import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createSupabaseClient: vi.fn(() => ({ client: 'bearer' })),
  createServerClient: vi.fn(() => ({ client: 'cookie' })),
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createSupabaseClient,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: mocks.createServerClient,
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

import { createClientForRequest } from '@/lib/supabase/server'

describe('createClientForRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  })

  it('creates a non-persistent user client from a bearer token', async () => {
    const client = await createClientForRequest(
      new Request('https://viewbait.app/api/generate', {
        headers: { authorization: 'Bearer oauth-access-token' },
      }),
    )

    expect(client).toEqual({ client: 'bearer' })
    expect(mocks.cookies).not.toHaveBeenCalled()
    expect(mocks.createSupabaseClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            Authorization: 'Bearer oauth-access-token',
          },
        },
      }),
    )
  })

  it('preserves cookie auth when no bearer token is supplied', async () => {
    const client = await createClientForRequest(
      new Request('https://viewbait.app/api/generate'),
    )

    expect(client).toEqual({ client: 'cookie' })
    expect(mocks.cookies).toHaveBeenCalledOnce()
    expect(mocks.createSupabaseClient).not.toHaveBeenCalled()
  })
})
