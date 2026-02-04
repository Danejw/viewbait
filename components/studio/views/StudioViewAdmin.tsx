"use client";

/**
 * StudioViewAdmin
 * Admin tab content when currentView === "admin". Required role guard: non-admins see "Access denied" and are redirected.
 */

import { useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewHeader } from "@/components/studio/view-controls";
import { AdminViewContent } from "@/components/admin/admin-view-content";
import { Card, CardContent } from "@/components/ui/card";

export default function StudioViewAdmin() {
  const { role } = useAuth();
  const { actions: { setView } } = useStudio();

  useEffect(() => {
    if (role !== "admin") {
      setView("generator");
    }
  }, [role, setView]);

  if (role !== "admin") {
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
