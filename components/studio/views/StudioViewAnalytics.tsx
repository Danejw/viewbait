"use client";

/**
 * StudioViewAnalytics
 * Standalone Analytics view when currentView === "analytics". Admin-only.
 * Full detailed snapshot: product/growth metrics and event-level analytics.
 */

import { useEffect } from "react";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewHeader } from "@/components/studio/view-controls";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { AdminAnalyticsDashboard } from "@/components/admin/admin-analytics-dashboard";
import { Card, CardContent } from "@/components/ui/card";

export default function StudioViewAnalytics() {
  const { isAdmin, isLoading } = useUserRole();
  const { actions: { setView } } = useStudio();

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setView("generator");
    }
  }, [isAdmin, isLoading, setView]);

  if (isLoading || !isAdmin) {
    return (
      <div>
        <ViewHeader title="Analytics" description="Full snapshot of product and event analytics." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">Access denied. Admin role required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ViewHeader
        title="Analytics"
        description="Full detailed snapshot: product metrics, growth, and event-level analytics."
      />
      <section>
        <h2 className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">
          Product & growth metrics
        </h2>
        <AdminDashboardClient />
      </section>
      <section>
        <h2 className="text-muted-foreground text-sm font-medium uppercase tracking-wider mb-2">
          Event-level analytics
        </h2>
        <AdminAnalyticsDashboard />
      </section>
    </div>
  );
}
