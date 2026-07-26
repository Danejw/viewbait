import { defineMcpTool, z } from 'yourindie-mcp'
import type { SupabaseClient } from '@supabase/supabase-js'
import { POST as generateThumbnailRoute } from '@/app/api/generate/route'
import { POST as editThumbnailRoute } from '@/app/api/edit/route'
import {
  createProject,
  getProjectByIdForAccess,
  listProjectsWithShared,
  updateProject,
} from '@/lib/server/data/projects'
import { getTierForUser } from '@/lib/server/utils/tier'
import {
  refreshFaceUrls,
  refreshStyleUrls,
  refreshThumbnailUrls,
} from '@/lib/server/utils/url-refresh'
import { compareThumbnails } from '@/lib/mcp/thumbnail-comparison'

export const DEFAULT_MCP_PERMISSIONS = [
  'account:read',
  'projects:read',
  'projects:write',
  'assets:read',
  'thumbnails:read',
  'thumbnails:write',
  'thumbnails:compare',
  'generation:write',
] as const

const uuid = z.string().uuid()
const nullableString = z.string().nullable()
const imageUrl = z.string().url().max(4096)

function asAppSupabase(supabase: unknown): SupabaseClient {
  return supabase as SupabaseClient
}

const projectDefaultSettingsSchema = z
  .object({
    thumbnailText: z.string().max(500).optional(),
    customInstructions: z.string().max(4000).optional(),
    includeStyles: z.boolean().optional(),
    selectedStyle: z.string().max(200).nullable().optional(),
    includePalettes: z.boolean().optional(),
    selectedPalette: z.string().max(200).nullable().optional(),
    selectedAspectRatio: z.string().max(20).optional(),
    selectedResolution: z.enum(['1K', '2K', '4K']).optional(),
    variations: z.number().int().min(1).max(4).optional(),
    includeStyleReferences: z.boolean().optional(),
    styleReferences: z.array(imageUrl).max(8).optional(),
    includeFaces: z.boolean().optional(),
    selectedFaces: z.array(uuid).max(4).optional(),
    faceExpression: z.string().max(200).optional(),
    facePose: z.string().max(200).optional(),
  })
  .strict()

const projectOutput = z.object({
  id: uuid,
  name: z.string(),
  access: z.enum(['owner', 'editor']),
  created_at: z.string(),
  updated_at: z.string(),
  default_settings: z.record(z.string(), z.unknown()).nullable(),
  share_mode: z.enum(['all', 'favorites']).nullable(),
})

const thumbnailOutput = z.object({
  id: uuid,
  project_id: uuid.nullable(),
  title: z.string(),
  image_url: z.string(),
  style: nullableString,
  palette: nullableString,
  emotion: nullableString,
  aspect_ratio: nullableString,
  resolution: nullableString,
  liked: z.boolean(),
  created_at: z.string(),
})

function formatProject(
  project: Record<string, unknown>,
  userId: string,
): z.infer<typeof projectOutput> {
  return {
    id: String(project.id),
    name: String(project.name),
    access: project.user_id === userId ? 'owner' : 'editor',
    created_at: String(project.created_at),
    updated_at: String(project.updated_at),
    default_settings:
      project.default_settings && typeof project.default_settings === 'object'
        ? (project.default_settings as Record<string, unknown>)
        : null,
    share_mode:
      project.share_mode === 'all' || project.share_mode === 'favorites'
        ? project.share_mode
        : null,
  }
}

function formatThumbnail(thumbnail: Record<string, unknown>) {
  return {
    id: String(thumbnail.id),
    project_id: typeof thumbnail.project_id === 'string' ? thumbnail.project_id : null,
    title: typeof thumbnail.title === 'string' ? thumbnail.title : '',
    image_url: typeof thumbnail.image_url === 'string' ? thumbnail.image_url : '',
    style: typeof thumbnail.style === 'string' ? thumbnail.style : null,
    palette: typeof thumbnail.palette === 'string' ? thumbnail.palette : null,
    emotion: typeof thumbnail.emotion === 'string' ? thumbnail.emotion : null,
    aspect_ratio:
      typeof thumbnail.aspect_ratio === 'string' ? thumbnail.aspect_ratio : null,
    resolution:
      typeof thumbnail.resolution === 'string' ? thumbnail.resolution : null,
    liked: thumbnail.liked === true,
    created_at: String(thumbnail.created_at),
  }
}

async function invokeAuthenticatedRoute(
  route: (request: Request) => Promise<Response>,
  path: string,
  input: Record<string, unknown>,
  token: string,
): Promise<Record<string, unknown>> {
  const response = await route(
    new Request(`https://viewbait.internal${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    }),
  )
  const payload = (await response.json()) as Record<string, unknown>
  if (!response.ok) {
    const message =
      typeof payload.error === 'string' ? payload.error : `${path} failed`
    const code = typeof payload.code === 'string' ? ` (${payload.code})` : ''
    throw new Error(`${message}${code}`)
  }
  return payload
}

async function getOwnedThumbnailRows(
  supabase: SupabaseClient,
  userId: string,
  {
    projectId,
    liked,
    limit,
    offset,
  }: {
    projectId?: string
    liked?: boolean
    limit: number
    offset: number
  },
) {
  let query = supabase
    .from('thumbnails')
    .select(
      'id,project_id,title,image_url,style,palette,emotion,aspect_ratio,resolution,liked,created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (projectId) query = query.eq('project_id', projectId)
  if (liked !== undefined) query = query.eq('liked', liked)

  const { data, error } = await query
  if (error) throw error
  return refreshThumbnailUrls(
    supabase,
    (data ?? []) as Array<{ id: string; image_url: string | null }>,
    userId,
  )
}

async function getProjectThumbnailRows(
  supabase: SupabaseClient,
  projectId: string,
  limit: number,
) {
  const { data, error } = await supabase
    .from('thumbnails')
    .select(
      'id,user_id,project_id,title,image_url,style,palette,emotion,aspect_ratio,resolution,liked,created_at',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error

  return Promise.all(
    ((data ?? []) as Array<{
      id: string
      user_id: string
      image_url: string | null
    }>).map(async (thumbnail) => {
      const [refreshed] = await refreshThumbnailUrls(
        supabase,
        [thumbnail],
        thumbnail.user_id,
      )
      return refreshed
    }),
  )
}

const accountContextTool = defineMcpTool({
  name: 'get_account_context',
  title: 'Get account context',
  description:
    'Get the authenticated ViewBAIT account, plan capabilities, and current credit balance before generation or editing.',
  inputSchema: {},
  outputSchema: {
    account: z.object({
      user_id: uuid,
      email: nullableString,
      full_name: nullableString,
    }),
    subscription: z.object({
      status: z.string(),
      credits_remaining: z.number().int().nonnegative(),
      credits_total: z.number().int().nonnegative(),
      current_period_end: nullableString,
    }),
    generation_capabilities: z.object({
      plan_name: z.string(),
      allowed_resolutions: z.array(z.enum(['1K', '2K', '4K'])),
      allowed_aspect_ratios: z.array(z.string()),
      max_variations: z.number().int().min(1).max(4),
      has_watermark: z.boolean(),
      can_create_custom_assets: z.boolean(),
    }),
  },
  readOnly: true,
  requiredPermissions: ['account:read'],
  async handler(_input, { supabase, userId }) {
    const [profileResult, subscriptionResult, tier] = await Promise.all([
      supabase
        .from('profiles')
        .select('id,email,full_name')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_subscriptions')
        .select('status,credits_remaining,credits_total,current_period_end')
        .eq('user_id', userId)
        .maybeSingle(),
      getTierForUser(asAppSupabase(supabase), userId),
    ])
    if (profileResult.error) throw profileResult.error
    if (subscriptionResult.error) throw subscriptionResult.error

    const profile = profileResult.data
    const subscription = subscriptionResult.data
    return {
      account: {
        user_id: userId,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
      },
      subscription: {
        status: subscription?.status ?? 'free',
        credits_remaining: subscription?.credits_remaining ?? 10,
        credits_total: subscription?.credits_total ?? 10,
        current_period_end: subscription?.current_period_end ?? null,
      },
      generation_capabilities: {
        plan_name: tier.name,
        allowed_resolutions: tier.allowed_resolutions,
        allowed_aspect_ratios: tier.allowed_aspect_ratios,
        max_variations: tier.max_variations,
        has_watermark: tier.has_watermark,
        can_create_custom_assets: tier.can_create_custom,
      },
    }
  },
})

const listProjectsTool = defineMcpTool({
  name: 'list_projects',
  title: 'List projects',
  description:
    'List ViewBAIT projects available to the authenticated user, including projects shared for editing.',
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().nonnegative().default(0),
    include_shared: z.boolean().default(true),
  },
  outputSchema: {
    projects: z.array(projectOutput),
    next_offset: z.number().int().nonnegative().nullable(),
  },
  readOnly: true,
  requiredPermissions: ['projects:read'],
  async handler({ limit, offset, include_shared }, { supabase, userId }) {
    const { data, error } = await listProjectsWithShared(
      asAppSupabase(supabase),
      userId,
    )
    if (error) throw error
    const available = include_shared
      ? data
      : data.filter((project) => project.user_id === userId)
    const page = available.slice(offset, offset + limit)
    return {
      projects: page.map((project) =>
        formatProject(project as unknown as Record<string, unknown>, userId),
      ),
      next_offset: offset + limit < available.length ? offset + limit : null,
    }
  },
})

const getProjectWorkspaceTool = defineMcpTool({
  name: 'get_project_workspace',
  title: 'Get project workspace',
  description:
    'Get a project, its saved generation defaults, access level, thumbnail count, and recent thumbnails.',
  inputSchema: {
    project_id: uuid,
    thumbnail_limit: z.number().int().min(1).max(50).default(12),
  },
  outputSchema: {
    project: projectOutput,
    thumbnail_count: z.number().int().nonnegative(),
    recent_thumbnails: z.array(thumbnailOutput),
  },
  readOnly: true,
  requiredPermissions: ['projects:read', 'thumbnails:read'],
  async handler({ project_id, thumbnail_limit }, { supabase, userId }) {
    const { data: project, error } = await getProjectByIdForAccess(
      asAppSupabase(supabase),
      project_id,
      userId,
    )
    if (error) throw error
    if (!project) throw new Error('Project not found or access denied.')

    const [thumbnailRows, countResult] = await Promise.all([
      getProjectThumbnailRows(
        asAppSupabase(supabase),
        project_id,
        thumbnail_limit,
      ),
      supabase
        .from('thumbnails')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', project_id),
    ])
    if (countResult.error) throw countResult.error

    return {
      project: formatProject(
        project as unknown as Record<string, unknown>,
        userId,
      ),
      thumbnail_count: countResult.count ?? 0,
      recent_thumbnails: thumbnailRows.map((thumbnail) =>
        formatThumbnail(thumbnail as unknown as Record<string, unknown>),
      ),
    }
  },
})

const createProjectTool = defineMcpTool({
  name: 'create_project',
  title: 'Create project',
  description:
    'Create a ViewBAIT project with optional saved generation defaults.',
  inputSchema: {
    name: z.string().trim().min(1).max(200),
    default_settings: projectDefaultSettingsSchema.optional(),
  },
  outputSchema: { project: projectOutput },
  readOnly: false,
  destructive: false,
  idempotent: false,
  requiredPermissions: ['projects:write'],
  async handler({ name, default_settings }, { supabase, userId }) {
    const { data, error } = await createProject(asAppSupabase(supabase), {
      user_id: userId,
      name,
      ...(default_settings !== undefined && { default_settings }),
    })
    if (error) throw error
    if (!data) throw new Error('Project creation returned no project.')
    return {
      project: formatProject(
        data as unknown as Record<string, unknown>,
        userId,
      ),
    }
  },
})

const updateProjectTool = defineMcpTool({
  name: 'update_project',
  title: 'Update project',
  description:
    'Update the name or saved generation defaults for a project owned by the authenticated user.',
  inputSchema: {
    project_id: uuid,
    name: z.string().trim().min(1).max(200).optional(),
    default_settings: projectDefaultSettingsSchema.nullable().optional(),
  },
  outputSchema: { project: projectOutput },
  readOnly: false,
  destructive: false,
  idempotent: true,
  requiredPermissions: ['projects:write'],
  async handler(
    { project_id, name, default_settings },
    { supabase, userId },
  ) {
    if (name === undefined && default_settings === undefined) {
      throw new Error('Provide name or default_settings to update.')
    }
    const { data, error } = await updateProject(
      asAppSupabase(supabase),
      project_id,
      userId,
      {
        ...(name !== undefined && { name }),
        ...(default_settings !== undefined && { default_settings }),
      },
    )
    if (error) throw error
    if (!data) throw new Error('Project not found or access denied.')
    return {
      project: formatProject(
        data as unknown as Record<string, unknown>,
        userId,
      ),
    }
  },
})

const listGenerationAssetsTool = defineMcpTool({
  name: 'list_generation_assets',
  title: 'List generation assets',
  description:
    'List available ViewBAIT styles, palettes, and saved face references for generation.',
  inputSchema: {
    asset_types: z
      .array(z.enum(['styles', 'palettes', 'faces']))
      .min(1)
      .max(3)
      .default(['styles', 'palettes', 'faces']),
    limit_per_type: z.number().int().min(1).max(100).default(50),
  },
  outputSchema: {
    styles: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        description: nullableString,
        prompt: nullableString,
        reference_images: z.array(z.string()),
        is_default: z.boolean(),
        is_public: z.boolean(),
      }),
    ),
    palettes: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        colors: z.array(z.string()),
        is_default: z.boolean(),
        is_public: z.boolean(),
      }),
    ),
    faces: z.array(
      z.object({
        id: uuid,
        name: z.string(),
        image_urls: z.array(z.string()),
      }),
    ),
  },
  readOnly: true,
  requiredPermissions: ['assets:read'],
  async handler({ asset_types, limit_per_type }, { supabase, userId }) {
    const requested = new Set(asset_types)
    const [styleResult, paletteResult, faceResult] = await Promise.all([
      requested.has('styles')
        ? supabase
            .from('styles')
            .select(
              'id,name,description,prompt,reference_images,is_default,is_public',
            )
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit_per_type)
        : Promise.resolve({ data: [], error: null }),
      requested.has('palettes')
        ? supabase
            .from('palettes')
            .select('id,name,colors,is_default,is_public')
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(limit_per_type)
        : Promise.resolve({ data: [], error: null }),
      requested.has('faces')
        ? supabase
            .from('faces')
            .select('id,name,image_urls')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit_per_type)
        : Promise.resolve({ data: [], error: null }),
    ])
    if (styleResult.error) throw styleResult.error
    if (paletteResult.error) throw paletteResult.error
    if (faceResult.error) throw faceResult.error

    const [styles, faces] = await Promise.all([
      refreshStyleUrls(
        asAppSupabase(supabase),
        (styleResult.data ?? []) as Array<{
          id: string
          reference_images?: string[]
        }>,
        userId,
      ),
      refreshFaceUrls(
        asAppSupabase(supabase),
        (faceResult.data ?? []) as Array<{ id: string; image_urls: string[] }>,
        userId,
      ),
    ])

    return {
      styles: styles.map((style) => {
        const row = style as Record<string, unknown>
        return {
          id: String(row.id),
          name: typeof row.name === 'string' ? row.name : '',
          description:
            typeof row.description === 'string' ? row.description : null,
          prompt: typeof row.prompt === 'string' ? row.prompt : null,
          reference_images: Array.isArray(row.reference_images)
            ? row.reference_images.filter(
                (url): url is string => typeof url === 'string',
              )
            : [],
          is_default: row.is_default === true,
          is_public: row.is_public === true,
        }
      }),
      palettes: (paletteResult.data ?? []).map((palette) => ({
        id: String(palette.id),
        name: typeof palette.name === 'string' ? palette.name : '',
        colors: Array.isArray(palette.colors)
          ? palette.colors.filter(
              (color): color is string => typeof color === 'string',
            )
          : [],
        is_default: palette.is_default === true,
        is_public: palette.is_public === true,
      })),
      faces: faces.map((face) => {
        const row = face as Record<string, unknown>
        return {
          id: String(row.id),
          name: typeof row.name === 'string' ? row.name : '',
          image_urls: Array.isArray(row.image_urls)
            ? row.image_urls.filter(
                (url): url is string => typeof url === 'string',
              )
            : [],
        }
      }),
    }
  },
})

const listThumbnailsTool = defineMcpTool({
  name: 'list_thumbnails',
  title: 'List thumbnails',
  description:
    'List generated thumbnails owned by the authenticated user, with project and favorite filters.',
  inputSchema: {
    limit: z.number().int().min(1).max(100).default(25),
    offset: z.number().int().nonnegative().default(0),
    project_id: uuid.optional(),
    liked: z.boolean().optional(),
  },
  outputSchema: {
    thumbnails: z.array(thumbnailOutput),
    next_offset: z.number().int().nonnegative().nullable(),
  },
  readOnly: true,
  requiredPermissions: ['thumbnails:read'],
  async handler(
    { limit, offset, project_id, liked },
    { supabase, userId },
  ) {
    const rows = await getOwnedThumbnailRows(asAppSupabase(supabase), userId, {
      projectId: project_id,
      liked,
      limit: limit + 1,
      offset,
    })
    const hasMore = rows.length > limit
    return {
      thumbnails: rows
        .slice(0, limit)
        .map((thumbnail) =>
          formatThumbnail(thumbnail as unknown as Record<string, unknown>),
        ),
      next_offset: hasMore ? offset + limit : null,
    }
  },
})

const generatedThumbnailOutput = z.object({
  success: z.boolean(),
  thumbnail_id: uuid.optional(),
  image_url: z.string().optional(),
  error: z.string().optional(),
})

const generateThumbnailsTool = defineMcpTool({
  name: 'generate_thumbnails',
  title: 'Generate thumbnails',
  description:
    'Generate one to four ViewBAIT thumbnails using the account plan, credits, saved assets, and project context.',
  inputSchema: {
    project_id: uuid.nullable().optional(),
    title: z.string().max(500).optional(),
    thumbnail_text: z.string().max(500).optional(),
    custom_instructions: z.string().max(4000).optional(),
    emotion: z.string().max(200).optional(),
    pose: z.string().max(200).optional(),
    style: z.string().max(200).optional(),
    palette: z.string().max(200).optional(),
    resolution: z.enum(['1K', '2K', '4K']).default('1K'),
    aspect_ratio: z
      .enum(['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'])
      .default('16:9'),
    variations: z.number().int().min(1).max(4).default(1),
    image_model: z
      .enum(['nano-banana-pro', 'nano-banana-2', 'gpt-image-2'])
      .optional(),
    reference_images: z.array(imageUrl).max(8).default([]),
    face_characters: z
      .array(z.object({ images: z.array(imageUrl).min(1).max(5) }).strict())
      .max(4)
      .default([]),
  },
  outputSchema: {
    thumbnails: z.array(generatedThumbnailOutput),
    credits_used: z.number().int().nonnegative(),
    credits_remaining: z.number().int().nonnegative(),
    total_requested: z.number().int().min(1).max(4),
    total_succeeded: z.number().int().nonnegative(),
    total_failed: z.number().int().nonnegative(),
  },
  readOnly: false,
  destructive: false,
  idempotent: false,
  openWorld: true,
  requiredPermissions: ['generation:write'],
  async handler(input, { token }) {
    const payload = await invokeAuthenticatedRoute(
      generateThumbnailRoute,
      '/api/generate',
      {
        project_id: input.project_id,
        title: input.title,
        thumbnailText: input.thumbnail_text,
        customStyle: input.custom_instructions,
        emotion: input.emotion,
        pose: input.pose,
        style: input.style,
        palette: input.palette,
        resolution: input.resolution,
        aspectRatio: input.aspect_ratio,
        variations: input.variations,
        imageModel: input.image_model,
        referenceImages: input.reference_images,
        faceCharacters: input.face_characters,
      },
      token,
    )

    if (Array.isArray(payload.results)) {
      const thumbnails = payload.results.map((raw) => {
        const result = raw as Record<string, unknown>
        return {
          success: result.success === true,
          ...(typeof result.thumbnailId === 'string' && {
            thumbnail_id: result.thumbnailId,
          }),
          ...(typeof result.imageUrl === 'string' && {
            image_url: result.imageUrl,
          }),
          ...(typeof result.error === 'string' && { error: result.error }),
        }
      })
      return {
        thumbnails,
        credits_used: Number(payload.creditsUsed ?? 0),
        credits_remaining: Number(payload.creditsRemaining ?? 0),
        total_requested: Number(payload.totalRequested ?? input.variations),
        total_succeeded: Number(
          payload.totalSucceeded ??
            thumbnails.filter((thumbnail) => thumbnail.success).length,
        ),
        total_failed: Number(
          payload.totalFailed ??
            thumbnails.filter((thumbnail) => !thumbnail.success).length,
        ),
      }
    }

    return {
      thumbnails: [
        {
          success: true,
          thumbnail_id: String(payload.thumbnailId),
          image_url: String(payload.imageUrl),
        },
      ],
      credits_used: Number(payload.creditsUsed ?? 0),
      credits_remaining: Number(payload.creditsRemaining ?? 0),
      total_requested: 1,
      total_succeeded: 1,
      total_failed: 0,
    }
  },
})

const editThumbnailTool = defineMcpTool({
  name: 'edit_thumbnail',
  title: 'Edit thumbnail',
  description:
    'Create a new thumbnail version by applying a focused edit prompt to an owned ViewBAIT thumbnail.',
  inputSchema: {
    thumbnail_id: uuid,
    edit_prompt: z.string().trim().min(1).max(500),
    title: z.string().trim().min(1).max(500).optional(),
    image_model: z
      .enum(['nano-banana-pro', 'nano-banana-2', 'gpt-image-2'])
      .optional(),
    reference_images: z.array(imageUrl).max(8).default([]),
  },
  outputSchema: {
    thumbnail_id: uuid,
    original_thumbnail_id: uuid,
    image_url: z.string(),
    credits_used: z.number().int().nonnegative(),
    credits_remaining: z.number().int().nonnegative(),
  },
  readOnly: false,
  destructive: false,
  idempotent: false,
  openWorld: true,
  requiredPermissions: ['thumbnails:write'],
  async handler(input, { token }) {
    const payload = await invokeAuthenticatedRoute(
      editThumbnailRoute,
      '/api/edit',
      {
        thumbnailId: input.thumbnail_id,
        editPrompt: input.edit_prompt,
        title: input.title,
        imageModel: input.image_model,
        referenceImages: input.reference_images,
      },
      token,
    )
    return {
      thumbnail_id: String(payload.thumbnailId),
      original_thumbnail_id: String(payload.originalThumbnailId),
      image_url: String(payload.imageUrl),
      credits_used: Number(payload.creditsUsed ?? 0),
      credits_remaining: Number(payload.creditsRemaining ?? 0),
    }
  },
})

const compareThumbnailsTool = defineMcpTool({
  name: 'compare_thumbnails',
  title: 'Compare thumbnails',
  description:
    'Compare two to four owned thumbnails with a multimodal creative review. Scores are predictions, not measured CTR.',
  inputSchema: {
    thumbnail_ids: z.array(uuid).min(2).max(4),
    objective: z.string().trim().min(1).max(1000).optional(),
  },
  outputSchema: {
    winner_thumbnail_id: uuid,
    winner_rationale: z.string(),
    candidates: z.array(
      z.object({
        thumbnail_id: uuid,
        predicted_click_appeal: z.number().min(0).max(100),
        clarity: z.number().min(0).max(100),
        visual_hierarchy: z.number().min(0).max(100),
        emotional_impact: z.number().min(0).max(100),
        mobile_readability: z.number().min(0).max(100),
        strengths: z.array(z.string()),
        risks: z.array(z.string()),
      }),
    ),
    recommended_next_steps: z.array(z.string()),
  },
  readOnly: true,
  openWorld: true,
  requiredPermissions: ['thumbnails:read', 'thumbnails:compare'],
  async handler({ thumbnail_ids, objective }, { supabase, userId }) {
    const comparison = await compareThumbnails(
      asAppSupabase(supabase),
      userId,
      thumbnail_ids,
      objective,
    )
    return { ...comparison }
  },
})

export const mcpTools = [
  accountContextTool,
  listProjectsTool,
  getProjectWorkspaceTool,
  createProjectTool,
  updateProjectTool,
  listGenerationAssetsTool,
  listThumbnailsTool,
  generateThumbnailsTool,
  editThumbnailTool,
  compareThumbnailsTool,
]
