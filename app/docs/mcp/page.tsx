import type { Metadata } from 'next'
import { McpDocsView } from '@/components/docs/mcp-docs-view'

export const metadata: Metadata = {
  title: 'Connect ViewBait MCP | Docs',
  description:
    'Connect Cursor, Claude, or ChatGPT to ViewBait MCP. Use the www endpoint, complete OAuth consent, and start generating thumbnails from your AI client.',
  openGraph: {
    title: 'Connect ViewBait MCP',
    description:
      'Step-by-step guide to connect remote MCP clients to https://www.viewbait.app/api/mcp',
  },
}

/**
 * Public documentation for successfully connecting a remote MCP client to ViewBait.
 */
export default function McpDocsPage() {
  return <McpDocsView />
}
