"use client";

/**
 * Subscription Modal
 *
 * Displays subscription tier options and allows users to select/upgrade their plan.
 * Uses Stripe checkout for payment processing.
 */

import { useState } from "react";
import { Check, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type TierName, type TierConfig } from "@/lib/constants/subscription-tiers";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useSubscriptionTiers } from "@/lib/hooks/useSubscriptionTiers";
import { logClientError } from "@/lib/utils/client-logger";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier: TierName;
  currentProductId: string | null;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  currentTier,
  currentProductId,
}: SubscriptionModalProps) {
  const { openCheckout } = useSubscription();
  const { tiers: tiersData, isLoading: tiersLoading } = useSubscriptionTiers();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  // Wait for tiers to load
  if (tiersLoading || Object.keys(tiersData).length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleSelectTier = async (tierConfig: TierConfig, tierName: TierName) => {
    // Don't allow selecting the current tier
    if (tierName === currentTier) {
      return;
    }

    // Free tier doesn't have a price_id, so we can't checkout for it
    if (!tierConfig.price_id) {
      return;
    }

    setLoadingPriceId(tierConfig.price_id);

    try {
      const { error } = await openCheckout(tierConfig.price_id);

      if (error) {
        logClientError(error, {
          operation: "open-checkout",
          component: "SubscriptionModal",
          tier: tierName,
        });
        setLoadingPriceId(null);
        return;
      }

      // Close modal before redirect
      onClose();
    } catch (error) {
      logClientError(error as Error, {
        operation: "open-checkout",
        component: "SubscriptionModal",
        tier: tierName,
      });
      setLoadingPriceId(null);
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "Free";
    return `$${price.toFixed(2)}`;
  };

  const formatResolutions = (resolutions: string[]) => {
    return resolutions.join(", ");
  };

  const getFeatureList = (tierConfig: TierConfig) => {
    const features: string[] = [];

    features.push(`${tierConfig.credits_per_month} credits/mo`);
    features.push(`${formatResolutions(tierConfig.allowed_resolutions)} resolution`);

    // Variations feature
    if (tierConfig.max_variations === 1) {
      features.push("1 variation per generation");
    } else {
      features.push(`Up to ${tierConfig.max_variations} variations`);
    }

    if (!tierConfig.has_watermark) {
      features.push("No watermark");
    }

    if (tierConfig.has_enhance) {
      features.push("AI Title Enhancement");
    }

    // Custom assets feature
    if (tierConfig.can_create_custom) {
      features.push("Custom styles, palettes & faces");
    }

    if (tierConfig.persistent_storage) {
      features.push("Permanent storage");
    } else {
      features.push(`${tierConfig.storage_retention_days}-day storage`);
    }

    if (tierConfig.priority_generation) {
      features.push("Priority generation");
    }

    if (tierConfig.early_access) {
      features.push("Early access");
    }

    return features;
  };

  const tiers: TierName[] = ["free", "starter", "advanced", "pro"];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold">Choose Your Plan</DialogTitle>
          <DialogDescription>
            Select a subscription tier that fits your needs
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
          {tiers.map((tierName) => {
            const tierConfig = tiersData[tierName];
            if (!tierConfig) return null;
            const isCurrentTier = tierName === currentTier;
            const isLoading = loadingPriceId === tierConfig.price_id;
            const canSelect = !isCurrentTier && tierConfig.price_id !== null;

            return (
              <Card
                key={tierName}
                className={`relative flex flex-col transition-all ${
                  isCurrentTier
                    ? "ring-2 ring-primary shadow-lg"
                    : "hover:shadow-md"
                } ${!canSelect && !isCurrentTier ? "opacity-60" : ""}`}
              >
                {isCurrentTier && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                      Current Plan
                    </span>
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    {tierName !== "free" && (
                      <Crown className="h-5 w-5 text-primary flex-shrink-0" />
                    )}
                    <CardTitle className="text-lg">{tierConfig.name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-2xl font-bold">
                      {formatPrice(tierConfig.price)}
                    </span>
                    {tierConfig.price > 0 && (
                      <span className="text-sm text-muted-foreground">/month</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <ul className="mb-4 flex-1 space-y-2 text-sm text-muted-foreground">
                    {getFeatureList(tierConfig).map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="break-words leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrentTier ? "secondary" : "default"}
                    size="sm"
                    onClick={() => handleSelectTier(tierConfig, tierName)}
                    disabled={!canSelect || isLoading}
                    className="w-full mt-auto"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentTier ? (
                      "Current Plan"
                    ) : tierConfig.price_id ? (
                      "Select Plan"
                    ) : (
                      "N/A"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground pt-2">
          <p>
            All plans include access to our thumbnail generation tools. Upgrade or
            downgrade at any time.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
