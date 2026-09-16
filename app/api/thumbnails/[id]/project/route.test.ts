import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuth: vi.fn(async () => ({ id: 'user-1' })),
  getProjectById: vi.fn(),
  getProjectByIdForAccess: vi.fn(),
  logError: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/server/utils/auth', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/server/data/projects', () => ({
  getProjectById: mocks.getProjectById,
  getProjectByIdForAccess: mocks.getProjectByIdForAccess,
}))

vi.mock('@/lib/server/utils/logger', () => ({
  logError: mocks.logError,
  logInfo: vi.fn(),
}))

import { POST } from '@/app/api/thumbnails/[id]/project/route'

function createThumbnailsClient(options: {
  existing?: { id: string } | null
  updated?: Record<string, unknown> | null
}) {
  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => {
      if (builder.update === undefined) {
        return { data: options.existing ?? null, error: options.existing ? null : { message: 'missing' } }
      }
      return { data: options.updated ?? options.existing ?? null, error: null }
    }),
  })

  // Distinguish first .single() (ownership check) vs update().select().single()
  let updateCalled = false
  builder.update = vi.fn(() => {
    updateCalled = true
    return builder
  })
  builder.single = vi.fn(async () => {
    if (!updateCalled) {
      return {
        data: options.existing ?? null,
        error: options.existing ? null : { message: 'missing' },
      }
    }
    return { data: options.updated ?? null, error: null }
  })

  return {
    from: vi.fn(() => builder),
  }
}

describe('POST /api/thumbnails/[id]/project', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'user-1' })
    mocks.getProjectByIdForAccess.mockResolvedValue({
      data: { id: 'proj-1', user_id: 'user-1' },
      error: null,
    })
  })

  it('assigns a thumbnail to a project without throwing a missing helper ReferenceError', async () => {
    const updated = { id: 'thumb-1', project_id: 'proj-1', user_id: 'user-1' }
    mocks.createClient.mockResolvedValue(
      createThumbnailsClient({ existing: { id: 'thumb-1' }, updated })
    )

    const response = await POST(
      new Request('https://viewbait.app/api/thumbnails/thumb-1/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: 'proj-1' }),
      }),
      { params: Promise.resolve({ id: 'thumb-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.getProjectByIdForAccess).toHaveBeenCalledWith(
      expect.anything(),
      'proj-1',
      'user-1'
    )
    await expect(response.json()).resolves.toEqual({ thumbnail: updated })
  })
})
