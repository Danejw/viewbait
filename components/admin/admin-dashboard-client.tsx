"use client";

/**
 * Client component for admin dashboard. Fetches analytics from API and displays metrics.
 * Supports range selector (7d / 30d), sectioned layout, and breakdowns.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AdminAnalytics {
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

type RangeKey = "7d" | "30d";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-sm font-medium uppercase tracking-wider pt-4 first:pt-0">
      {children}
    </h3>
  );
}

function MetricCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: number | string;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {sub != null && sub !== "" && (
          <p className="text-muted-foreground text-xs mt-1">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  items,
  className,
}: {
  title: string;
  items: Record<string, number>;
  className?: string;
}) {
  const entries = Object.entries(items).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5 text-sm">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between gap-2">
              <span className="text-muted-foreground truncate">{key}</span>
              <span className="font-medium tabular-nums shrink-0">{count.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardClient() {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics?range=${range}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "Failed to load analytics");
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive text-sm">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const growth = data.growth ?? {
    signupsLast7d: 0,
    signupsLast30d: 0,
    onboardingCompletedCount: 0,
    onboardingRate: 0,
  };
  const engagement = data.engagement ?? {
    thumbnailsLast7d: 0,
    thumbnailsLast30d: 0,
    projectsLast7d: 0,
    projectsLast30d: 0,
    creditsUsedLast7d: 0,
    creditsUsedLast30d: 0,
    creditsByType: {},
  };
  const subscriptions = data.subscriptions ?? { byStatus: {}, byProductId: {} };
  const notifications = data.notifications ?? { readCount: 0, readRate: 0, byType: {} };
  const feedback = data.feedback ?? {
    total: 0,
    byStatus: {},
    byCategory: {},
    recent: [],
  };
  const experiments = data.experiments ?? { byStatus: {} };
  const referrals = data.referrals ?? { total: 0, byStatus: {} };
  const youtube = data.youtube ?? { connectedIntegrations: 0, channelsCount: 0 };

  const signupsInRange = range === "7d" ? growth.signupsLast7d : growth.signupsLast30d;
  const thumbnailsInRange = range === "7d" ? engagement.thumbnailsLast7d : engagement.thumbnailsLast30d;
  const projectsInRange = range === "7d" ? engagement.projectsLast7d : engagement.projectsLast30d;
  const creditsInRange = range === "7d" ? engagement.creditsUsedLast7d : engagement.creditsUsedLast30d;
  const openFeedback =
    (feedback.byStatus["New"] ?? 0) +
    (feedback.byStatus["Pending"] ?? 0) +
    (feedback.byStatus["Triage"] ?? 0);
  const activeSubscriptions =
    subscriptions.byStatus["active"] ?? subscriptions.byStatus["trialing"] ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant={range === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setRange(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      <section>
        <SectionHeading>Summary</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-2">
          <MetricCard label="Users (profiles)" value={data.profilesCount} />
          <MetricCard label="Thumbnails" value={data.thumbnailsCount} />
          <MetricCard label="Projects" value={data.projectsCount} />
          <MetricCard label="Subscriptions" value={data.subscriptionsCount} />
          <MetricCard label="Experiments" value={data.experimentsCount} />
          <MetricCard label="Notifications" value={data.notificationsCount} />
        </div>
      </section>

      <section>
        <SectionHeading>Growth</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
          <MetricCard
            label="Signups (range)"
            value={signupsInRange}
            sub={`7d: ${growth.signupsLast7d} · 30d: ${growth.signupsLast30d}`}
          />
          <MetricCard
            label="Onboarding completed"
            value={growth.onboardingCompletedCount}
            sub={`${(growth.onboardingRate * 100).toFixed(1)}% of users`}
          />
        </div>
      </section>

      <section>
        <SectionHeading>Engagement</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
          <MetricCard
            label="Thumbnails (range)"
            value={thumbnailsInRange}
            sub={`7d: ${engagement.thumbnailsLast7d} · 30d: ${engagement.thumbnailsLast30d}`}
          />
          <MetricCard
            label="Projects (range)"
            value={projectsInRange}
            sub={`7d: ${engagement.projectsLast7d} · 30d: ${engagement.projectsLast30d}`}
          />
          <MetricCard
            label="Credits used (range)"
            value={creditsInRange}
            sub={`7d: ${engagement.creditsUsedLast7d} · 30d: ${engagement.creditsUsedLast30d}`}
          />
        </div>
      </section>

      <section>
        <SectionHeading>Monetization</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
          <MetricCard label="Active subscriptions" value={activeSubscriptions} />
          <BreakdownCard title="Subscriptions by status" items={subscriptions.byStatus} />
          {Object.keys(subscriptions.byProductId).length > 0 && (
            <BreakdownCard title="By product" items={subscriptions.byProductId} />
          )}
        </div>
      </section>

      <section>
        <SectionHeading>Health & feedback</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
          <MetricCard label="Open feedback" value={openFeedback} sub={`of ${feedback.total} total`} />
          <MetricCard
            label="Notifications read rate"
            value={`${(notifications.readRate * 100).toFixed(1)}%`}
            sub={`${notifications.readCount} read`}
          />
          <BreakdownCard title="Feedback by status" items={feedback.byStatus} />
          <BreakdownCard title="Feedback by category" items={feedback.byCategory} />
          <BreakdownCard title="Experiments by status" items={experiments.byStatus} />
        </div>
        {feedback.recent && feedback.recent.length > 0 && (
          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent feedback</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-left">
                      <th className="pb-2 pr-2 font-medium">Status</th>
                      <th className="pb-2 pr-2 font-medium">Category</th>
                      <th className="pb-2 pr-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.recent.map((row) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 pr-2">{row.status}</td>
                        <td className="py-2 pr-2">{row.category}</td>
                        <td className="py-2 pr-2 text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 truncate max-w-[200px]" title={row.message}>
                          {row.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionHeading>Referrals & integrations</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-2">
          <MetricCard label="Referrals" value={referrals.total} />
          <BreakdownCard title="Referrals by status" items={referrals.byStatus} />
          <MetricCard label="YouTube connected" value={youtube.connectedIntegrations} />
          <MetricCard label="YouTube channels" value={youtube.channelsCount} />
        </div>
      </section>
    </div>
  );
}
