"use client";

/**
 * Editor link page: /e/[slug]
 * Authenticated users hit this after middleware. Join project by editor_slug, then redirect to studio.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { joinByEditorSlug } from "@/lib/services/projects";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

export default function EditorLinkPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const normalizedSlug = slug || null;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    emitTourEvent("tour.event.route.ready", {
      routeKey: "share.editor",
      anchorsPresent: ["tour.share.editor.state.progress"],
    });
  }, []);

  useEffect(() => {
    if (!normalizedSlug) {
      return;
    }
    let cancelled = false;
    (async () => {
      const { project, error } = await joinByEditorSlug(normalizedSlug);
      if (cancelled) return;
      if (error) {
        setStatus("error");
        setErrorMessage(error.message || "Could not join project");
        return;
      }
      if (project?.id) {
        setStatus("success");
        window.location.href = `/studio?project=${encodeURIComponent(project.id)}`;
        return;
      }
      setStatus("error");
      setErrorMessage("Project not found or link is invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [normalizedSlug]);

  if (!normalizedSlug) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4" data-tour="tour.share.editor.state.error">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Could not open project</h1>
          <p className="text-sm text-muted-foreground">Invalid link</p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Home
        </Link>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4" data-tour="tour.share.editor.state.progress">
        <ViewBaitLogo className="h-10 w-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Opening project…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4" data-tour="tour.share.editor.state.error">
        <div className="text-center space-y-2">
          <h1 className="text-lg font-semibold text-foreground">Could not open project</h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/studio"
            data-tour="tour.share.editor.btn.goStudio"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Studio
          </Link>
          <Link
            href="/"
            className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
      <ViewBaitLogo className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm text-muted-foreground">Redirecting to studio…</p>
    </div>
  );
}
