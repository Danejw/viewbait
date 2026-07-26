import { defineMcpTool, z } from 'yourindie-mcp';

const DEFAULT_MCP_PERMISSIONS = ['projects:read', 'thumbnails:read'] as const;

export const mcpTools = [
  defineMcpTool({
    name: 'list_projects',
    title: 'List projects',
    description: "List the authenticated user's thumbnail projects.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(25),
    },
    readOnly: true,
    requiredPermissions: ['projects:read'],
    async handler({ limit }, { supabase, userId }) {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, created_at, updated_at, share_slug, share_mode')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { projects: data ?? [] };
    },
  }),
  defineMcpTool({
    name: 'list_thumbnails',
    title: 'List thumbnails',
    description: "List the authenticated user's generated thumbnails.",
    inputSchema: {
      limit: z.number().int().min(1).max(100).default(25),
      project_id: z.string().uuid().optional(),
    },
    readOnly: true,
    requiredPermissions: ['thumbnails:read'],
    async handler({ limit, project_id }, { supabase, userId }) {
      let query = supabase
        .from('thumbnails')
        .select(
          'id, title, image_url, style, palette, liked, created_at, resolution, aspect_ratio, project_id',
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (project_id) {
        query = query.eq('project_id', project_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return { thumbnails: data ?? [] };
    },
  }),
];

export { DEFAULT_MCP_PERMISSIONS };
