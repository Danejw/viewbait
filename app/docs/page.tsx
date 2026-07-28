import { redirect } from 'next/navigation'

/**
 * Docs index currently focuses on MCP connection. Redirect keeps a stable /docs entry.
 */
export default function DocsIndexPage() {
  redirect('/docs/mcp')
}
