"use client";

/**
 * Account Settings Modal
 *
 * Opens when the user clicks the account name/email block in the left sidebar.
 * Allows changing the account display name; email is read-only.
 */

import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/hooks/useAuth";
import { updateFullName } from "@/lib/services/profiles";

const DISPLAY_NAME_MAX_LENGTH = 255;

export interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountSettingsModal({
  isOpen,
  onClose,
}: AccountSettingsModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const initialDisplayName =
    profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? "";
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isSaving, setIsSaving] = useState(false);

  const displayEmail = profile?.email || user?.email || "";

  // Sync form when modal opens or profile/user changes
  useEffect(() => {
    if (isOpen) {
      const name =
        profile?.full_name ?? (user?.user_metadata?.full_name as string | undefined) ?? "";
      setDisplayName(name);
    }
  }, [isOpen, profile?.full_name, user?.user_metadata?.full_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      toast.error("Display name cannot be empty");
      return;
    }
    if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
      toast.error(`Display name must be ${DISPLAY_NAME_MAX_LENGTH} characters or less`);
      return;
    }
    setIsSaving(true);
    const { profile: updated, error } = await updateFullName(trimmed);
    setIsSaving(false);
    if (error) {
      toast.error(error.message || "Failed to update name");
      return;
    }
    await refreshProfile();
    toast.success("Name updated");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-md">
        <DialogHeader className="space-y-1.5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <User className="h-5 w-5 text-primary" />
            Account settings
          </DialogTitle>
          <DialogDescription>
            Update your display name. Your email is shown for reference and cannot be changed here.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-display-name">Display name</Label>
            <Input
              id="account-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              disabled={isSaving}
              autoComplete="name"
              aria-describedby="account-display-name-hint"
            />
            <p id="account-display-name-hint" className="text-xs text-muted-foreground">
              Max {DISPLAY_NAME_MAX_LENGTH} characters. Shown in the sidebar and across the app.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div
              className="h-7 rounded-md border border-input bg-muted/30 px-2 py-1.5 text-sm text-muted-foreground"
              aria-readonly
            >
              {displayEmail || "—"}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
