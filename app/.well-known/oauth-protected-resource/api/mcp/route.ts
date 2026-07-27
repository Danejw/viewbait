import { createProtectedResourceMetadataResponse } from 'yourindie-mcp';

export function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const resourceUrl = process.env.MCP_RESOURCE_URL;
  if (!supabaseUrl || !resourceUrl) {
    return Response.json({ error: 'MCP metadata is not configured.' }, { status: 500 });
  }

  return createProtectedResourceMetadataResponse({
    resourceUrl,
    issuer: `${supabaseUrl}/auth/v1`,
    resourceName: 'ViewBAIT',
    scopesSupported: ['openid', 'email', 'profile'],
  });
}
