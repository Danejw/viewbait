/**
 * Server-side markdown to HTML for legal pages.
 * Used so the client can inject pre-rendered HTML and avoid ReactMarkdown/remarkGfm on the client.
 */

import { marked } from "marked";

/**
 * Convert markdown to HTML. External links get target="_blank" and rel="noopener noreferrer".
 * Call only on the server (e.g. in app/legal/* page components).
 */
export function markdownToHtml(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true }) as string;
  return addExternalLinkAttrs(html);
}

/** Add target="_blank" rel="noopener noreferrer" to links that start with http. */
function addExternalLinkAttrs(html: string): string {
  return html.replace(
    /<a href="(https?:\/\/[^"]*)"/gi,
    '<a href="$1" target="_blank" rel="noopener noreferrer"'
  );
}
