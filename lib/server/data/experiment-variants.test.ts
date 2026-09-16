import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { replaceExperimentVariant } from '@/lib/server/data/experiment-variants'

function createReplaceMock(options: {
  updated?: Record<string, unknown> | null
  updateError?: Error | null
  inserted?: Record<string, unknown> | null
  insertError?: Error | null
}) {
  const ops: string[] = []
  const updatePayloads: unknown[] = []
  const insertPayloads: unknown[] = []

  const builder: Record<string, unknown> = {}
  Object.assign(builder, {
    update: vi.fn((payload: unknown) => {
      ops.push('update')
      updatePayloads.push(payload)
      return builder
    }),
    insert: vi.fn((payload: unknown) => {
      ops.push('insert')
      insertPayloads.push(payload)
      return builder
    }),
    delete: vi.fn(() => {
      ops.push('delete')
      return builder
    }),
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({
      data: options.updated ?? null,
      error: options.updateError ?? null,
    })),
    single: vi.fn(async () => ({
      data: options.inserted ?? null,
      error: options.insertError ?? null,
    })),
  })

  return {
    client: { from: vi.fn(() => builder) } as unknown as SupabaseClient,
    ops,
    updatePayloads,
    insertPayloads,
  }
}

const input = {
  experimentId: 'exp-1',
  label: 'A' as const,
  titleText: 'New title',
  thumbnailAssetUrl: 'https://cdn.example/a.png',
  thumbnailId: 'thumb-new',
}

describe('replaceExperimentVariant', () => {
  it('updates an existing variant in place and never deletes', async () => {
    const existing = {
      id: 'var-1',
      experiment_id: 'exp-1',
      label: 'A',
      title_text: 'New title',
      thumbnail_asset_url: 'https://cdn.example/a.png',
      thumbnail_id: 'thumb-new',
    }
    const mock = createReplaceMock({ updated: existing })

    const result = await replaceExperimentVariant(mock.client, input)

    expect(result.error).toBeNull()
    expect(result.data).toEqual(existing)
    expect(mock.ops).toEqual(['update'])
    expect(mock.insertPayloads).toEqual([])
  })

  it('inserts when no variant exists yet and never deletes', async () => {
    const inserted = {
      id: 'var-2',
      experiment_id: 'exp-1',
      label: 'A',
      title_text: 'New title',
      thumbnail_asset_url: 'https://cdn.example/a.png',
      thumbnail_id: 'thumb-new',
    }
    const mock = createReplaceMock({ updated: null, inserted })

    const result = await replaceExperimentVariant(mock.client, input)

    expect(result.error).toBeNull()
    expect(result.data).toEqual(inserted)
    expect(mock.ops).toEqual(['update', 'insert'])
  })
})
