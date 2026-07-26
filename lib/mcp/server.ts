import { createSupabaseMcpApp, type SupabaseMcpTool } from 'yourindie-mcp';
import { DEFAULT_MCP_PERMISSIONS, mcpTools } from '@/lib/mcp/tools';

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const resourceUrl = required('MCP_RESOURCE_URL', process.env.MCP_RESOURCE_URL);
const supabaseUrl = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const mcpApp = createSupabaseMcpApp({
  name: 'ViewBAIT',
  resourceUrl,
  issuer: `${supabaseUrl}/auth/v1`,
  supabaseUrl,
  supabaseAnonKey: required(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  tools: mcpTools as unknown as SupabaseMcpTool[],
  healthPath: false,
  expectedAudience:
    process.env.MCP_STRICT_AUDIENCE === 'false' ? undefined : resourceUrl,
  resolvePermissions(context) {
    const permissions = context.claims.mcp_permissions;
    return Array.isArray(permissions)
      ? permissions.filter((permission): permission is string => typeof permission === 'string')
      : [...DEFAULT_MCP_PERMISSIONS];
  },
  audit(event) {
    console.info('[MCP audit]', event);
  },
});
