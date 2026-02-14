"use client";

/**
 * StudioViewAdmin
 * Admin tab content when currentView === "admin". Required role guard: non-admins see "Access denied" and are redirected.
 */

import { useEffect } from "react";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewHeader } from "@/components/studio/view-controls";
import { AdminViewContent } from "@/components/admin/admin-view-content";
import { Card, CardContent } from "@/components/ui/card";

export default function StudioViewAdmin() {
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
        <ViewHeader title="Admin" description="Application analytics and internal tools." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">Access denied. Admin role required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ViewHeader
        title="Admin"
        description="Application analytics and internal tools."
      />
      <AdminViewContent />
    </div>
  );
}
