/**
 * Click-rank border utilities
 *
 * Single source of truth for click-rank visual scale: gold/silver/bronze for top 3 only.
 * Rank 4+ get no border or shading. Rank is computed per project;
 * thumbnails with no clicks get no border.
 */

// ---------------------------------------------------------------------------
// Colors (CSS variables in globals.css control actual values; these match class names)
// ---------------------------------------------------------------------------

export const CLICK_RANK_GOLD = "#d4af37";
export const CLICK_RANK_SILVER = "#c0c0c0";
export const CLICK_RANK_BRONZE = "#cd7f32";

/** Gradient: rank 4 = orange, middle = green, lowest rank with clicks = none */
export const CLICK_RANK_GRADIENT_ORANGE = "#f97316";
export const CLICK_RANK_GRADIENT_GREEN = "#22c55e";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClickRankTier = "gold" | "silver" | "bronze" | "gradient" | "none";

export interface ClickRankInfo {
  rank: number;
  totalWithClicks: number;
  tier: ClickRankTier;
}

export interface ClickRankBorderResult {
  tier: ClickRankTier;
  className?: string;
  style?: Record<string, string | number>;
  /** Reserved for future use (e.g. rank 4+ shading). */
  shadingClass?: string;
}

/** Minimal thumbnail shape for rank computation (id, projectId, shareClickCount) */
export interface ClickRankThumbnailInput {
  id: string;
  projectId?: string | null;
  shareClickCount?: number;
}

const BORDER_CLASS_PREFIX = "click-rank-border";

/**
 * Competition ranking: same count ⇒ same rank; next rank skips (e.g. 1, 2, 2, 4).
 * Returns map: thumbnailId → { rank, totalWithClicks } for items that have clicks.
 */
export function computeClickRanksByProject(
  thumbnails: ClickRankThumbnailInput[]
): Map<string, { rank: number; totalWithClicks: number }> {
  const result = new Map<string, { rank: number; totalWithClicks: number }>();

  // Group by projectId (use string key; null → "__null__" for Map key)
  const byProject = new Map<string, ClickRankThumbnailInput[]>();
  for (const t of thumbnails) {
    const key = t.projectId ?? "__null__";
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(t);
  }

  for (const [, group] of byProject) {
    const withClicks = group
      .filter((t) => (t.shareClickCount ?? 0) > 0)
      .sort((a, b) => (b.shareClickCount ?? 0) - (a.shareClickCount ?? 0));
    const totalWithClicks = withClicks.length;
    if (totalWithClicks === 0) continue;

    let rank = 1;
    let prevCount: number | undefined;
    for (let i = 0; i < withClicks.length; i++) {
      const count = withClicks[i].shareClickCount ?? 0;
      if (prevCount !== undefined && count < prevCount) {
        rank = i + 1;
      }
      result.set(withClicks[i].id, { rank, totalWithClicks });
      prevCount = count;
    }
  }

  return result;
}

/**
 * Maps (rank, totalWithClicksInProject) to border tier and CSS class.
 * Gold/silver/bronze for 1–3; rank 4+ get no styling.
 */
export function getClickRankBorder(
  rank: number,
  totalWithClicksInProject: number
): ClickRankBorderResult {
  if (rank <= 0 || totalWithClicksInProject <= 0) {
    return { tier: "none" };
  }
  if (rank === 1) return { tier: "gold", className: `${BORDER_CLASS_PREFIX}-gold` };
  if (rank === 2) return { tier: "silver", className: `${BORDER_CLASS_PREFIX}-silver` };
  if (rank === 3) return { tier: "bronze", className: `${BORDER_CLASS_PREFIX}-bronze` };

  // Rank 4+ get no visual treatment (no shading); only top 3 show medal/border.
  return { tier: "none" };
}

/** Map value: border (medal) and/or shading (rank 4+) styling. */
export interface ClickRankBorderMapEntry {
  className?: string;
  style?: Record<string, string | number>;
  shadingClass?: string;
}

/**
 * One-shot: from a list of thumbnails, compute per-project ranks and return
 * a map thumbnailId → { className?, style?, shadingClass? }.
 * Gold/silver/bronze get className only; rank 4+ are omitted (no styling).
 */
export function getClickRankBorderMap(
  thumbnails: ClickRankThumbnailInput[]
): Map<string, ClickRankBorderMapEntry> {
  const rankMap = computeClickRanksByProject(thumbnails);
  const borderMap = new Map<string, ClickRankBorderMapEntry>();
  for (const [id, { rank, totalWithClicks }] of rankMap) {
    const border = getClickRankBorder(rank, totalWithClicks);
    if (border.className || border.shadingClass) {
      borderMap.set(id, {
        className: border.className,
        style: border.style,
        shadingClass: border.shadingClass,
      });
    }
  }
  return borderMap;
}
