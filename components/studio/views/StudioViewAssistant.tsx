"use client";

/**
 * StudioViewAssistant
 * Renders Pro CTA or reusable assistant panel in the center between the two sidebars.
 */

import React, { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { StudioAssistantPanel } from "@/components/studio/studio-assistant-panel";
import SubscriptionModal from "@/components/subscription-modal";

export default function StudioViewAssistant() {
  const { tier, productId } = useSubscription();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const isPro = tier === "pro";

  if (!isPro) {
    return (
      <>
        <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
          <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-8 text-center max-w-md">
            <div className="rounded-full bg-muted p-4">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold">YouTube Assistant is for Pro</h2>
            <p className="text-sm text-muted-foreground">
              Connect your channel and talk to the AI about your videos and analytics. Upgrade to Pro to unlock.
            </p>
            <Button onClick={() => setSubscriptionModalOpen(true)}>Upgrade to Pro</Button>
          </div>
        </div>
        <SubscriptionModal
          isOpen={subscriptionModalOpen}
          onClose={() => setSubscriptionModalOpen(false)}
          currentTier={tier}
          currentProductId={productId ?? null}
        />
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <StudioAssistantPanel tier={tier} productId={productId ?? null} className="min-h-0 flex-1" />
    </div>
  );
}
