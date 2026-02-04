"use client";

/**
 * Reusable admin content: Dashboard (analytics), Users (placeholder), Broadcast (form).
 * Used inside StudioViewAdmin; can be embedded elsewhere.
 */

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminDashboardClient } from "@/components/admin/admin-dashboard-client";
import { cn } from "@/lib/utils";

export interface AdminViewContentProps {
  className?: string;
}

export function AdminViewContent({ className }: AdminViewContentProps) {
  return (
    <Tabs defaultValue="dashboard" className={cn("flex flex-col gap-4", className)}>
      <TabsList variant="line" className="w-fit">
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
      </TabsList>
      <TabsContent value="dashboard" className="mt-0">
        <AdminDashboardClient />
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
