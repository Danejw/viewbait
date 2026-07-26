import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { requireAuthForRequest } from '@/lib/server/utils/auth'

function authClient(getUser: ReturnType<typeof vi.fn>): SupabaseClient {
  return {
    auth: { getUser },
  } as unknown as SupabaseClient
}

describe('requireAuthForRequest', () => {
  it('validates an OAuth bearer token explicitly', async () => {
    const user = { id: 'user-1' }
    const getUser = vi.fn(async () => ({
      data: { user },
      error: null,
    }))

    await expect(
      requireAuthForRequest(
        authClient(getUser),
        new Request('https://viewbait.app/api/generate', {
          headers: { authorization: 'Bearer oauth-token' },
        }),
      ),
    ).resolves.toEqual(user)
    expect(getUser).toHaveBeenCalledWith('oauth-token')
  })

  it('uses the existing session when no bearer token is present', async () => {
    const user = { id: 'user-1' }
    const getUser = vi.fn(async () => ({
      data: { user },
      error: null,
    }))

    await expect(
      requireAuthForRequest(
        authClient(getUser),
        new Request('https://viewbait.app/api/generate'),
      ),
    ).resolves.toEqual(user)
    expect(getUser).toHaveBeenCalledWith()
  })
})
