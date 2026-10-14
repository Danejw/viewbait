import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20261014160100_thumbnails_editor_update_guard.sql',
)
const sql = readFileSync(migrationPath, 'utf8')

type ThumbnailRow = {
  user_id: string
  project_id: string | null
  image_url: string
  comments: unknown
  updated_at: string
}

type GuardDecision = 'allow' | 'ownership' | 'editor-columns'

/**
 * Mirrors enforce_thumbnail_update_columns(). Service role is a null actor.
 * Editors may change comments and updated_at only. Owners cannot reassign user_id.
 */
function classifyThumbnailUpdate(
  actorId: string | null,
  previous: ThumbnailRow,
  next: ThumbnailRow,
): GuardDecision {
  if (actorId === null) return 'allow'
  if (previous.user_id === actorId) {
    if (next.user_id !== previous.user_id) return 'ownership'
    return 'allow'
  }

  const { comments: previousComments, updated_at: previousUpdatedAt, ...previousRest } = previous
  const { comments: nextComments, updated_at: nextUpdatedAt, ...nextRest } = next
  void previousComments
  void previousUpdatedAt
  void nextComments
  void nextUpdatedAt

  return JSON.stringify(previousRest) === JSON.stringify(nextRest) ? 'allow' : 'editor-columns'
}

const ownerRow: ThumbnailRow = {
  user_id: 'owner',
  project_id: 'project-1',
  image_url: 'https://cdn.example/owner.png',
  comments: [],
  updated_at: '2026-10-01T00:00:00.000Z',
}

describe('thumbnail update guard', () => {
  it('allows an invited editor to append a comment', () => {
    expect(
      classifyThumbnailUpdate('editor', ownerRow, {
        ...ownerRow,
        comments: [{ user_id: 'editor', comment: 'ship it', created_at: '2026-10-14T00:00:00.000Z' }],
        updated_at: '2026-10-14T00:00:00.000Z',
      }),
    ).toBe('allow')
  })

  it('blocks an editor from taking ownership and detaching the project', () => {
    expect(
      classifyThumbnailUpdate('editor', ownerRow, {
        ...ownerRow,
        user_id: 'editor',
        project_id: null,
      }),
    ).toBe('editor-columns')
  })

  it('blocks an editor from replacing the image or assigning the row to someone else', () => {
    expect(
      classifyThumbnailUpdate('editor', ownerRow, {
        ...ownerRow,
        image_url: 'https://cdn.example/replaced.png',
      }),
    ).toBe('editor-columns')
    expect(
      classifyThumbnailUpdate('editor', ownerRow, {
        ...ownerRow,
        user_id: 'someone-else',
      }),
    ).toBe('editor-columns')
  })

  it('allows the owner to edit their own payload without reassigning user_id', () => {
    expect(
      classifyThumbnailUpdate('owner', ownerRow, {
        ...ownerRow,
        image_url: 'https://cdn.example/new.png',
        project_id: null,
      }),
    ).toBe('allow')
  })

  it('blocks the owner from reassigning user_id', () => {
    expect(
      classifyThumbnailUpdate('owner', ownerRow, {
        ...ownerRow,
        user_id: 'editor',
      }),
    ).toBe('ownership')
  })

  it('allows service-role writes that have no auth.uid()', () => {
    expect(
      classifyThumbnailUpdate(null, ownerRow, {
        ...ownerRow,
        user_id: 'editor',
        image_url: 'https://cdn.example/admin.png',
      }),
    ).toBe('allow')
  })

  it('ships the same guard as a before-update trigger', () => {
    expect(sql).toMatch(/if auth\.uid\(\) is null then/i)
    expect(sql).toMatch(/if old\.user_id = auth\.uid\(\) then/i)
    expect(sql).toMatch(/new\.user_id is distinct from old\.user_id/i)
    expect(sql).toContain('thumbnail ownership cannot be reassigned')
    expect(sql).toContain("pg_catalog.to_jsonb(new) - 'comments' - 'updated_at'")
    expect(sql).toContain("pg_catalog.to_jsonb(old) - 'comments' - 'updated_at'")
    expect(sql).toContain('project editors can only update thumbnail comments')
    expect(sql).toMatch(/before update on public\.thumbnails/i)
    expect(sql).toMatch(/execute function public\.enforce_thumbnail_update_columns\(\)/i)
    expect(sql).toMatch(/revoke all on function public\.enforce_thumbnail_update_columns\(\) from anon;/i)
    expect(sql).toMatch(/grant execute on function public\.enforce_thumbnail_update_columns\(\) to authenticated, service_role;/i)
  })
})
