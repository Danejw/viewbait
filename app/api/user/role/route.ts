/**
 * GET /api/user/role
 *
 * Returns the current user's role from the roles table.
 * Used by the Studio sidebar to conditionally show the Admin nav link.
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/utils/auth";
import { getUserRole } from "@/lib/server/utils/roles";
import { handleApiError } from "@/lib/server/utils/api-helpers";

export async function GET() {
  try {
    const supabase = await createClient();
    const user = await requireAuth(supabase);
    const role = await getUserRole(supabase, user.id);
    return NextResponse.json({ role });
  } catch (error) {
    return handleApiError(
      error,
      "GET /api/user/role",
      "user-role",
      undefined,
      "Failed to fetch user role"
    );
  }
}
