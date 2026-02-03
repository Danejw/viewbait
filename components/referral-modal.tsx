"use client";

/**
 * Referral Modal
 *
 * Displays the user's referral code (if any), copy button, stats, and create-code flow.
 * Only users with an active subscription can create a referral code.
 */

import { useState } from "react";
import { Gift, Copy, Check } from "lucide-react";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { toast } from "sonner";
import { copyToClipboardWithToast } from "@/lib/utils/clipboard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReferrals } from "@/lib/hooks/useReferrals";
import { useSubscription } from "@/lib/hooks/useSubscription";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const {
    referralCode,
    stats,
    isLoading,
    isCreating,
    createReferralCode,
    refresh,
  } = useReferrals();
  const { isSubscribed } = useSubscription();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!referralCode) return;
    const ok = await copyToClipboardWithToast(referralCode, "Referral code copied to clipboard");
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreate = async () => {
    const result = await createReferralCode();
    if (result.success) {
      toast.success(result.message);
      await refresh();
    } else {
      toast.error(result.message);
    }
  };

  const handleUnlock = () => {
    onClose();
    // User can open subscription via the credits section in the sidebar
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-md">
        <DialogHeader className="space-y-1.5 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <Gift className="h-5 w-5 text-primary" />
            Referral Code
          </DialogTitle>
          <DialogDescription>
            Share your code so friends get 10 free credits when they sign up and
            make a purchase. You get 10 credits for each qualified referral.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <ViewBaitLogo className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : referralCode ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Your code
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 text-lg font-mono font-semibold tracking-wide">
                  {referralCode}
                </code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0"
                  aria-label="Copy referral code"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {stats && stats.total > 0 && (
              <p className="text-sm text-muted-foreground">
                {stats.rewarded} friend{stats.rewarded !== 1 ? "s" : ""} joined
                {stats.pending > 0 && ` · ${stats.pending} pending`}
              </p>
            )}
          </div>
        ) : isSubscribed ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Create a unique referral code to share. You can only have one code.
            </p>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Referral Code"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Make a purchase to unlock your own referral code. Then share it so
              friends get 10 free credits when they sign up and buy—and you get
              10 credits for each.
            </p>
            <Button onClick={handleUnlock} variant="default" className="w-full">
              View plans
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
