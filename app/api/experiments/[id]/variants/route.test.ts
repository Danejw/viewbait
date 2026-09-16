import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireAuth: vi.fn(async () => ({ id: 'user-1' })),
  ops: [] as Array<{ table: string; op: string }>,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}))

vi.mock('@/lib/server/utils/auth', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/server/utils/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}))

import { POST } from '@/app/api/experiments/[id]/variants/route'

function createExperimentsClient() {
  mocks.ops.length = 0

  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {}
    const finalize = async () => {
      if (table === 'experiments') {
        return {
          data: { id: 'exp-1', user_id: 'user-1', status: 'draft' },
          error: null,
        }
      }
      if (table === 'experiment_variants') {
        return { data: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], error: null }
      }
      return { data: null, error: null }
    }

    Object.assign(builder, {
      select: vi.fn(() => {
        mocks.ops.push({ table, op: 'select' })
        return builder
      }),
      insert: vi.fn(() => {
        mocks.ops.push({ table, op: 'insert' })
        return builder
      }),
      update: vi.fn(() => {
        mocks.ops.push({ table, op: 'update' })
        return builder
      }),
      delete: vi.fn(() => {
        mocks.ops.push({ table, op: 'delete' })
        return builder
      }),
      eq: vi.fn(() => builder),
      single: vi.fn(() => finalize()),
      maybeSingle: vi.fn(() => finalize()),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(finalize()).then(resolve, reject),
    })
    return builder
  })

  return { from }
}

describe('POST /api/experiments/[id]/variants', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ id: 'user-1' })
    mocks.createClient.mockResolvedValue(createExperimentsClient())
  })

  it('does not delete existing variants when title is missing', async () => {
    const response = await POST(
      new Request('https://viewbait.app/api/experiments/exp-1/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'exp-1' }) }
    )

    expect(response.status).toBe(400)
    expect(mocks.ops.filter((op) => op.op === 'delete')).toEqual([])
  })

  it('does not delete existing variants when generation fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'INSUFFICIENT_CREDITS' }), { status: 402 })
      )
    )

    const response = await POST(
      new Request('https://viewbait.app/api/experiments/exp-1/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My video' }),
      }),
      { params: Promise.resolve({ id: 'exp-1' }) }
    )

    expect(response.status).toBeGreaterThanOrEqual(500)
    expect(mocks.ops.filter((op) => op.op === 'delete')).toEqual([])
    vi.unstubAllGlobals()
  })
})
