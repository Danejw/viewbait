import { createNextRouteHandlers } from 'yourindie-mcp/next';
import { mcpApp } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const { GET, POST, DELETE, OPTIONS } = createNextRouteHandlers(mcpApp);
