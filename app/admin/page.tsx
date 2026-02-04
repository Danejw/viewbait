import { redirect } from "next/navigation";

/**
 * Redirect /admin to studio with admin view selected.
 * Supports bookmarks and old links; actual admin content is in studio tab.
 */
export default function AdminRedirectPage() {
  redirect("/studio?view=admin");
}
