/**
 * GET /api/admin/analytics
 * Application-wide metrics (admin only). Uses service role after requireAdmin check.
 * Returns both 7d and 30d metrics; client may pass ?range=7d|30d for cache/UX.
 */

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/server/utils/roles";
import { serverErrorResponse } from "@/lib/server/utils/error-handler";
import { NextResponse } from "next/server";

export interface AdminAnalyticsResponse {
  profilesCount: number;
  thumbnailsCount: number;
  projectsCount: number;
  subscriptionsCount: number;
  experimentsCount: number;
  notificationsCount: number;
  growth: {
    signupsLast7d: number;
    signupsLast30d: number;
    onboardingCompletedCount: number;
    onboardingRate: number;
  };
  engagement: {
    thumbnailsLast7d: number;
    thumbnailsLast30d: number;
    projectsLast7d: number;
    projectsLast30d: number;
    creditsUsedLast7d: number;
    creditsUsedLast30d: number;
    creditsByType: Record<string, number>;
  };
  subscriptions: {
    byStatus: Record<string, number>;
    byProductId: Record<string, number>;
  };
  notifications: {
    readCount: number;
    readRate: number;
    byType: Record<string, { sent: number; read: number }>;
  };
  feedback: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    recent: Array<{ id: string; status: string; category: string; created_at: string; message: string }>;
  };
  experiments: {
    byStatus: Record<string, number>;
  };
  referrals: {
    total: number;
    byStatus: Record<string, number>;
  };
  youtube: {
    connectedIntegrations: number;
    channelsCount: number;
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    await requireAdmin(supabase);

    const service = createServiceClient();

    // Base counts (no date filter)
    const [
      { count: profilesCount },
      { count: thumbnailsCount },
      { count: projectsCount },
      { count: subscriptionsCount },
      { count: experimentsCount },
      { count: notificationsCount },
    ] = await Promise.all([
      service.from("profiles").select("*", { count: "exact", head: true }),
      service.from("thumbnails").select("*", { count: "exact", head: true }),
      service.from("projects").select("*", { count: "exact", head: true }),
      service.from("user_subscriptions").select("*", { count: "exact", head: true }),
      service.from("experiments").select("*", { count: "exact", head: true }),
      service.from("notifications").select("*", { count: "exact", head: true }),
    ]);

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0);
    const sevenIso = sevenDaysAgo.toISOString();
    const thirtyIso = thirtyDaysAgo.toISOString();

    // Growth: signups and onboarding
    const [
      { count: signupsLast7d },
      { count: signupsLast30d },
      { count: onboardingCompletedCount },
    ] = await Promise.all([
      service.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", sevenIso),
      service.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", thirtyIso),
      service.from("profiles").select("*", { count: "exact", head: true }).eq("onboarding_completed", true),
    ]);

    const totalProfiles = profilesCount ?? 0;
    const onboardingRate = totalProfiles > 0 ? ((onboardingCompletedCount ?? 0) / totalProfiles) : 0;

    // Engagement: thumbnails and projects in range
    const [
      { count: thumbnailsLast7d },
      { count: thumbnailsLast30d },
      { count: projectsLast7d },
      { count: projectsLast30d },
    ] = await Promise.all([
      service.from("thumbnails").select("*", { count: "exact", head: true }).gte("created_at", sevenIso),
      service.from("thumbnails").select("*", { count: "exact", head: true }).gte("created_at", thirtyIso),
      service.from("projects").select("*", { count: "exact", head: true }).gte("created_at", sevenIso),
      service.from("projects").select("*", { count: "exact", head: true }).gte("created_at", thirtyIso),
    ]);

    // Credits used: sum of |amount| where amount < 0 in range (consumption)
    const { data: credits7 } = await service
      .from("credit_transactions")
      .select("amount, type")
      .gte("created_at", sevenIso);
    const { data: credits30 } = await service
      .from("credit_transactions")
      .select("amount, type")
      .gte("created_at", thirtyIso);

    function sumCreditsUsed(rows: { amount: number; type: string }[] | null): { used: number; byType: Record<string, number> } {
      const byType: Record<string, number> = {};
      let used = 0;
      (rows ?? []).forEach((r) => {
        if (r.amount < 0) {
          const abs = Math.abs(r.amount);
          used += abs;
          const t = r.type || "unknown";
          byType[t] = (byType[t] ?? 0) + abs;
        }
      });
      return { used, byType };
    }

    const credits7Agg = sumCreditsUsed(credits7);
    const credits30Agg = sumCreditsUsed(credits30);

    // Subscriptions: by status and product_id
    const { data: subRows } = await service.from("user_subscriptions").select("status, product_id");
    const byStatus: Record<string, number> = {};
    const byProductId: Record<string, number> = {};
    (subRows ?? []).forEach((r) => {
      const s = r.status ?? "unknown";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      if (r.product_id) {
        byProductId[r.product_id] = (byProductId[r.product_id] ?? 0) + 1;
      }
    });

    // Notifications: read rate and by type
    const { data: notifRows } = await service.from("notifications").select("is_read, type");
    let readCount = 0;
    const notifByType: Record<string, { sent: number; read: number }> = {};
    (notifRows ?? []).forEach((r) => {
      if (r.is_read) readCount++;
      const t = r.type ?? "unknown";
      if (!notifByType[t]) notifByType[t] = { sent: 0, read: 0 };
      notifByType[t].sent++;
      if (r.is_read) notifByType[t].read++;
    });
    const totalNotif = notificationsCount ?? 0;
    const readRate = totalNotif > 0 ? readCount / totalNotif : 0;

    // Feedback: by status and category
    const { data: feedbackRows } = await service.from("feedback").select("status, category");
    const feedbackByStatus: Record<string, number> = {};
    const feedbackByCategory: Record<string, number> = {};
    (feedbackRows ?? []).forEach((r) => {
      const s = r.status ?? "Unknown";
      feedbackByStatus[s] = (feedbackByStatus[s] ?? 0) + 1;
      const c = r.category ?? "other";
      feedbackByCategory[c] = (feedbackByCategory[c] ?? 0) + 1;
    });
    const { count: feedbackTotal } = await service.from("feedback").select("*", { count: "exact", head: true });

    const { data: recentFeedbackRows } = await service
      .from("feedback")
      .select("id, status, category, created_at, message")
      .order("created_at", { ascending: false })
      .limit(10);
    const recentFeedback = (recentFeedbackRows ?? []).map((r) => ({
      id: r.id,
      status: r.status ?? "Unknown",
      category: r.category ?? "other",
      created_at: r.created_at,
      message: typeof r.message === "string" ? r.message.slice(0, 100) : "",
    }));

    // Experiments: by status
    const { data: expRows } = await service.from("experiments").select("status");
    const expByStatus: Record<string, number> = {};
    (expRows ?? []).forEach((r) => {
      const s = r.status ?? "unknown";
      expByStatus[s] = (expByStatus[s] ?? 0) + 1;
    });

    // Referrals: total and by status
    const { data: refRows } = await service.from("referrals").select("status");
    const refByStatus: Record<string, number> = {};
    (refRows ?? []).forEach((r) => {
      const s = r.status ?? "unknown";
      refByStatus[s] = (refByStatus[s] ?? 0) + 1;
    });
    const referralsTotal = refRows?.length ?? 0;

    // YouTube: connected integrations and channels
    const [
      { count: youtubeConnected },
      { count: youtubeChannels },
    ] = await Promise.all([
      service.from("youtube_integrations").select("*", { count: "exact", head: true }).eq("is_connected", true),
      service.from("youtube_channels").select("*", { count: "exact", head: true }),
    ]);

    const body: AdminAnalyticsResponse = {
      profilesCount: profilesCount ?? 0,
      thumbnailsCount: thumbnailsCount ?? 0,
      projectsCount: projectsCount ?? 0,
      subscriptionsCount: subscriptionsCount ?? 0,
      experimentsCount: experimentsCount ?? 0,
      notificationsCount: notificationsCount ?? 0,
      growth: {
        signupsLast7d: signupsLast7d ?? 0,
        signupsLast30d: signupsLast30d ?? 0,
        onboardingCompletedCount: onboardingCompletedCount ?? 0,
        onboardingRate,
      },
      engagement: {
        thumbnailsLast7d: thumbnailsLast7d ?? 0,
        thumbnailsLast30d: thumbnailsLast30d ?? 0,
        projectsLast7d: projectsLast7d ?? 0,
        projectsLast30d: projectsLast30d ?? 0,
        creditsUsedLast7d: credits7Agg.used,
        creditsUsedLast30d: credits30Agg.used,
        creditsByType: credits30Agg.byType,
      },
      subscriptions: { byStatus, byProductId },
      notifications: { readCount, readRate, byType: notifByType },
      feedback: {
        total: feedbackTotal ?? 0,
        byStatus: feedbackByStatus,
        byCategory: feedbackByCategory,
        recent: recentFeedback,
      },
      experiments: { byStatus: expByStatus },
      referrals: { total: referralsTotal, byStatus: refByStatus },
      youtube: {
        connectedIntegrations: youtubeConnected ?? 0,
        channelsCount: youtubeChannels ?? 0,
      },
    };

    return NextResponse.json(body);
  } catch (error) {
    if (error instanceof Response) return error;
    return serverErrorResponse(error, "Failed to load analytics");
  }
}
