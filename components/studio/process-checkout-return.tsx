"use client";

/**
 * Process Checkout on Return
 *
 * When the user lands on /studio?session_id=cs_xxx after Stripe checkout,
 * calls POST /api/process-checkout to sync the subscription to the DB,
 * then clears the URL and refreshes subscription state.
 * This makes the return flow work without relying on webhooks (e.g. local/sandbox).
 * All authority remains on the backend; the client only sends the session_id.
 */

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { logClientError } from "@/lib/utils/client-logger";
import { track } from "@/lib/analytics/track";

export function ProcessCheckoutOnReturn() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshSubscription } = useSubscription();
  const processedSessionIdRef = useRef<string | null>(null);
  const replaceDoneRef = useRef(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId?.trim()) return;
    if (processedSessionIdRef.current === sessionId) return;

    processedSessionIdRef.current = sessionId;

    (async () => {
      try {
        const res = await fetch("/api/process-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId.trim() }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errMsg = data?.error ?? `Process checkout failed: ${res.status}`;
          logClientError(new Error(errMsg), {
            operation: "process-checkout-return",
            component: "ProcessCheckoutOnReturn",
            sessionId: sessionId.slice(0, 20),
          });
          track("error", { context: "checkout", message: String(errMsg).slice(0, 200) });
          processedSessionIdRef.current = null;
          return;
        }

        track("checkout_completed");
        if (!replaceDoneRef.current) {
          replaceDoneRef.current = true;
          router.replace("/studio", { scroll: false });
        }
        await refreshSubscription();
      } catch (error) {
        logClientError(error as Error, {
          operation: "process-checkout-return",
          component: "ProcessCheckoutOnReturn",
        });
        processedSessionIdRef.current = null;
      }
    })();
  }, [searchParams, router, refreshSubscription]);

  return null;
}
