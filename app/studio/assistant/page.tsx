import { redirect } from 'next/navigation'

/**
 * Legacy route: Assistant is now a tab on /studio.
 * Redirect so bookmarks to /studio/assistant land on the studio; user can click Assistant in the sidebar.
 */
export default function AssistantRedirectPage() {
  redirect('/studio')
}
