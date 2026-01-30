"use client";

/**
 * Share Project Dialog
 *
 * Enables/disables sharing for a project, sets share mode (all vs favorites),
 * and shows a copyable share link.
 */

import React, { useCallback, useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProjects } from "@/lib/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { DbProject } from "@/lib/types/database";

export interface ShareProjectDialogProps {
  project: DbProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareProjectDialog({
  project,
  open,
  onOpenChange,
}: ShareProjectDialogProps) {
  const { updateProject } = useProjects();
  const [shareMode, setShareMode] = useState<'all' | 'favorites'>(project.share_mode === 'favorites' ? 'favorites' : 'all');
  const [displaySlug, setDisplaySlug] = useState<string | null>(project.share_slug ?? null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnabled = !!displaySlug;

  useEffect(() => {
    if (!open) return;
    setDisplaySlug(project.share_slug ?? null);
    setShareMode(project.share_mode === 'favorites' ? 'favorites' : 'all');
    setError(null);
  }, [open, project.id, project.share_slug, project.share_mode]);

  const shareUrl = typeof window !== 'undefined' && displaySlug
    ? `${window.location.origin}/p/${displaySlug}`
    : '';

  const copyLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const handleEnableToggle = useCallback(
    async (enabled: boolean) => {
      setError(null);
      setSaving(true);
      try {
        if (enabled) {
          const updated = await updateProject(project.id, { share_mode: shareMode });
          if (updated?.share_slug) {
            setDisplaySlug(updated.share_slug);
          } else {
            setError('Failed to generate share link');
          }
        } else {
          await updateProject(project.id, { share_slug: null });
          setDisplaySlug(null);
        }
      } catch {
        setError('Failed to update sharing settings');
      } finally {
        setSaving(false);
      }
    },
    [project.id, shareMode, updateProject]
  );

  const handleSaveMode = useCallback(async () => {
    if (!isEnabled) return;
    setError(null);
    setSaving(true);
    try {
      await updateProject(project.id, { share_mode: shareMode });
    } catch {
      setError('Failed to update share mode');
    } finally {
      setSaving(false);
    }
  }, [project.id, shareMode, isEnabled, updateProject]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Share project gallery
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="share-enabled">Enable sharing</Label>
            <Switch
              id="share-enabled"
              checked={isEnabled}
              onCheckedChange={handleEnableToggle}
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label>What to share</Label>
            <RadioGroup
              value={shareMode}
              onValueChange={(v) => setShareMode(v as 'all' | 'favorites')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="mode-all" disabled={saving} />
                <Label htmlFor="mode-all" className="font-normal cursor-pointer">
                  All thumbnails in this project
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="favorites" id="mode-favorites" disabled={saving} />
                <Label htmlFor="mode-favorites" className="font-normal cursor-pointer">
                  Only favorited thumbnails
                </Label>
              </div>
            </RadioGroup>
            {isEnabled && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={handleSaveMode}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save mode'}
              </Button>
            )}
          </div>

          {isEnabled && displaySlug && (
            <div className="space-y-2">
              <Label>Share link</Label>
              <div className="flex gap-2 items-stretch">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm ring-offset-background",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                />
                <Tooltip open={copied ? true : undefined}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyLink}
                      className="h-9 w-9 shrink-0 p-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {copied ? "Copied!" : "Copy link"}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can view the gallery. They cannot edit or add thumbnails.
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
