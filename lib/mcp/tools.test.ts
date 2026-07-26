import { describe, expect, it } from 'vitest'
import { z } from 'yourindie-mcp'
import { DEFAULT_MCP_PERMISSIONS, mcpTools } from '@/lib/mcp/tools'

const EXPECTED_TOOLS = [
  'get_account_context',
  'list_projects',
  'get_project_workspace',
  'create_project',
  'update_project',
  'list_generation_assets',
  'list_thumbnails',
  'generate_thumbnails',
  'edit_thumbnail',
  'compare_thumbnails',
] as const

const EXPECTED_PERMISSIONS: Record<(typeof EXPECTED_TOOLS)[number], string[]> = {
  get_account_context: ['account:read'],
  list_projects: ['projects:read'],
  get_project_workspace: ['projects:read', 'thumbnails:read'],
  create_project: ['projects:write'],
  update_project: ['projects:write'],
  list_generation_assets: ['assets:read'],
  list_thumbnails: ['thumbnails:read'],
  generate_thumbnails: ['generation:write'],
  edit_thumbnail: ['thumbnails:write'],
  compare_thumbnails: ['thumbnails:read', 'thumbnails:compare'],
}

describe('ViewBAIT MCP tool contract', () => {
  it('publishes the agreed ten tools in a stable order', () => {
    expect(mcpTools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS)
  })

  it('defines strict output schemas and explicit permissions for every tool', () => {
    for (const tool of mcpTools) {
      expect(tool.outputSchema, `${tool.name} output schema`).toBeDefined()
      expect(tool.requiredPermissions).toEqual(
        EXPECTED_PERMISSIONS[tool.name as (typeof EXPECTED_TOOLS)[number]],
      )
    }

    expect(new Set(DEFAULT_MCP_PERMISSIONS)).toEqual(
      new Set(Object.values(EXPECTED_PERMISSIONS).flat()),
    )
  })

  it('marks reads and writes with accurate MCP annotations', () => {
    const byName = Object.fromEntries(mcpTools.map((tool) => [tool.name, tool]))

    for (const name of [
      'get_account_context',
      'list_projects',
      'get_project_workspace',
      'list_generation_assets',
      'list_thumbnails',
      'compare_thumbnails',
    ]) {
      expect(byName[name].readOnly, name).toBe(true)
    }

    for (const name of [
      'create_project',
      'update_project',
      'generate_thumbnails',
      'edit_thumbnail',
    ]) {
      expect(byName[name].readOnly, name).toBe(false)
      expect(byName[name].destructive, name).toBe(false)
    }
  })

  it('rejects generation requests above the product variation limit', () => {
    const tool = mcpTools.find((candidate) => candidate.name === 'generate_thumbnails')
    expect(tool).toBeDefined()

    const schema = z.object(tool!.inputSchema)
    expect(() =>
      schema.parse({
        thumbnail_text: 'A surprising result',
        variations: 5,
      }),
    ).toThrow()
  })

  it('rejects edit prompts over 500 characters', () => {
    const tool = mcpTools.find((candidate) => candidate.name === 'edit_thumbnail')
    expect(tool).toBeDefined()

    const schema = z.object(tool!.inputSchema)
    expect(() =>
      schema.parse({
        thumbnail_id: 'd4a104cb-c7b4-4416-98cf-4ceda544a42e',
        edit_prompt: 'x'.repeat(501),
      }),
    ).toThrow()
  })

  it('requires between two and four thumbnails for comparison', () => {
    const tool = mcpTools.find((candidate) => candidate.name === 'compare_thumbnails')
    expect(tool).toBeDefined()

    const schema = z.object(tool!.inputSchema)
    expect(() =>
      schema.parse({
        thumbnail_ids: ['d4a104cb-c7b4-4416-98cf-4ceda544a42e'],
      }),
    ).toThrow()
    expect(
      schema.parse({
        thumbnail_ids: [
          'd4a104cb-c7b4-4416-98cf-4ceda544a42e',
          '95c7c143-1524-42e1-a98a-57e06dc93277',
        ],
      }),
    ).toBeDefined()
  })
})
