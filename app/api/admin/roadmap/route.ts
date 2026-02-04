/**
 * GET /api/admin/roadmap
 * Returns a brainstorm markdown by doc slug (admin only).
 * Query: ?doc=new_features|content_topics|marketing_strategy|technical_solutions
 * Default: new_features.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/server/utils/roles";
import { NextResponse } from "next/server";

const DOC_SLUG_TO_FILE: Record<string, string> = {
  new_features: "new_features_brainstorm.md",
  content_topics: "content_topics_brainstorm.md",
  marketing_strategy: "marketing_strategy_brainstorm.md",
  technical_solutions: "technical_solutions_brainstorm.md",
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireAdmin(supabase);

    const { searchParams } = new URL(request.url);
    const doc = searchParams.get("doc") ?? "new_features";
    const filename = DOC_SLUG_TO_FILE[doc];
    if (!filename) {
      return NextResponse.json(
        { error: "Invalid doc parameter" },
        { status: 400 }
      );
    }

    const filePath = join(process.cwd(), "docs/brainstorms", filename);
    const content = await readFile(filePath, "utf-8");

    return NextResponse.json({ content });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    return NextResponse.json(
      { error: "Failed to load roadmap" },
      { status: 500 }
    );
  }
}
