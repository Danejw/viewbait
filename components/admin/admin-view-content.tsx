"use client";

/**
 * Reusable admin content: Dashboard (overview), Users (placeholder), Broadcast (form).
 * Full analytics live in the standalone Analytics view (sidebar).
 */

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStudio } from "@/components/studio/studio-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedbackRecentItem = {
  id: string;
  status: string;
  category: string;
  created_at: string;
  message: string;
  email?: string | null;
};

export interface AdminViewContentProps {
  className?: string;
}

export function AdminViewContent({ className }: AdminViewContentProps) {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className={cn("flex flex-col gap-4", className)}>
      <TabsList variant="line" className="w-fit">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="mt-0">
        <AdminOverview
          onOpenUsers={() => setActiveTab("users")}
          onOpenBroadcast={() => setActiveTab("broadcast")}
        />
      </TabsContent>
      <TabsContent value="users" className="mt-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Coming soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              User table and role assignment UI can be added here. Use the service role client in an admin API route (e.g. POST /api/admin/users/[id]/role) to update the roles table.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="broadcast" className="mt-0">
        <AdminBroadcastForm />
      </TabsContent>
    </Tabs>
  );
}

/** Admin overview: quick health metrics, recent feedback list, and links. Full analytics in Analytics view. */
function AdminOverview({
  onOpenUsers,
  onOpenBroadcast,
}: {
  onOpenUsers: () => void;
  onOpenBroadcast: () => void;
}) {
  const { actions: { setView } } = useStudio();
  const [dashboard, setDashboard] = useState<{
    profilesCount: number;
    signupsLast30d: number;
    activeSubscriptions: number;
    openFeedback: number;
    recentFeedback: FeedbackRecentItem[];
  } | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRecentItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/analytics?range=30d")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const subs = data.subscriptions?.byStatus ?? {};
        const activeSubs = subs.active ?? subs.trialing ?? 0;
        const feedback = data.feedback ?? { total: 0, byStatus: {}, recent: [] };
        const open =
          (feedback.byStatus?.New ?? 0) +
          (feedback.byStatus?.Pending ?? 0) +
          (feedback.byStatus?.Triage ?? 0);
        setDashboard({
          profilesCount: data.profilesCount ?? 0,
          signupsLast30d: data.growth?.signupsLast30d ?? 0,
          activeSubscriptions: activeSubs,
          openFeedback: open,
          recentFeedback: Array.isArray(feedback.recent) ? feedback.recent : [],
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6 m-2">
      <div>
        <h2 className="text-lg font-semibold">Admin overview</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
          Quick health snapshot and access to admin tools. For full analytics, open Analytics from the sidebar.
        </p>
      </div>

      {/* Four quick health metrics */}
      {dashboard != null ? (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <Card className="p-3">
            <p className="text-muted-foreground text-xs font-medium">Users</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{dashboard.profilesCount.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-muted-foreground text-xs font-medium">Open feedback</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{dashboard.openFeedback.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-muted-foreground text-xs font-medium">Signups (30d)</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{dashboard.signupsLast30d.toLocaleString()}</p>
          </Card>
          <Card className="p-3">
            <p className="text-muted-foreground text-xs font-medium">Active subs</p>
            <p className="text-xl font-semibold tabular-nums mt-0.5">{dashboard.activeSubscriptions.toLocaleString()}</p>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-12 mt-2" />
            </Card>
          ))}
        </div>
      )}

      {/* Recent feedback list */}
      <div>
        <h3 className="text-sm font-medium mb-2">Recent feedback</h3>
        {dashboard == null ? (
          <Card className="p-4">
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </Card>
        ) : dashboard.recentFeedback.length === 0 ? (
          <Card className="p-4">
            <p className="text-muted-foreground text-sm">No feedback yet.</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="p-2 font-medium">Status</th>
                    <th className="p-2 font-medium">Category</th>
                    <th className="p-2 font-medium">Date</th>
                    <th className="p-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentFeedback.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedFeedback(row)}
                    >
                      <td className="p-2">{row.status}</td>
                      <td className="py-2">{row.category}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="p-2 truncate max-w-[200px]" title={row.message}>
                        {row.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Feedback detail modal */}
      <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          {selectedFeedback && (
            <>
              <DialogHeader>
                <DialogTitle>Feedback details</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                  <span>Status</span>
                  <span className="text-foreground">{selectedFeedback.status}</span>
                  <span>Category</span>
                  <span className="text-foreground">{selectedFeedback.category}</span>
                  <span>Date</span>
                  <span className="text-foreground">
                    {new Date(selectedFeedback.created_at).toLocaleString()}
                  </span>
                  {selectedFeedback.email != null && selectedFeedback.email !== "" && (
                    <>
                      <span>Email</span>
                      <span
                        className="text-foreground truncate block max-w-full"
                        title={selectedFeedback.email}
                      >
                        {selectedFeedback.email.length > 40
                          ? `${selectedFeedback.email.slice(0, 37)}...`
                          : selectedFeedback.email}
                      </span>
                    </>
                  )}
                </div>
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">Message</p>
                  <div className="rounded-md border bg-muted/30 p-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-foreground">
                    {selectedFeedback.message || "—"}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setView("analytics")}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Full analytics</p>
              <p className="text-muted-foreground text-xs">Product metrics, events, funnels, export</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={onOpenUsers}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Users</p>
              <p className="text-muted-foreground text-xs">User table and roles</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={onOpenBroadcast}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Radio className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Broadcast</p>
              <p className="text-muted-foreground text-xs">Send notification to all users</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function AdminBroadcastForm() {
  const [type, setType] = useState("announcement");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "success" | "warning" | "error">("info");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience: "all",
          notification: { type, title, body, severity },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Failed to broadcast");
        return;
      }
      setStatus("success");
      setMessage(`Sent to ${data?.count ?? 0} users.`);
      setTitle("");
      setBody("");
    } catch {
      setStatus("error");
      setMessage("Request failed");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New notification</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="admin-broadcast-type">Type</Label>
            <Input
              id="admin-broadcast-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. announcement"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-broadcast-title">Title</Label>
            <Input
              id="admin-broadcast-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-broadcast-body">Body</Label>
            <Textarea
              id="admin-broadcast-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body"
              rows={3}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-broadcast-severity">Severity</Label>
            <select
              id="admin-broadcast-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
              className="border-input bg-background ring-offset-background flex h-9 w-full rounded-md border px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="info">info</option>
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </div>
          {message && (
            <p className={status === "error" ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
              {message}
            </p>
          )}
          <Button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Sending…" : "Broadcast to all users"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
