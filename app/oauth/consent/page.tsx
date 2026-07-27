'use client';

import {
  approveAuthorization,
  denyAuthorization,
  getAuthorizationDetails,
  type OAuthAuthorizationDetails,
} from 'yourindie-mcp/consent';
import { buildOAuthConsentAuthRedirect } from '@/lib/mcp/consent-redirect';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ViewBaitLogo } from '@/components/ui/viewbait-logo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

/**
 * yourindie-mcp bundles its own @supabase/supabase-js types; cast at the consent API boundary.
 */
function asConsentClient(client: SupabaseClient): Parameters<typeof getAuthorizationDetails>[0] {
  return client as unknown as Parameters<typeof getAuthorizationDetails>[0];
}

/**
 * Navigate to an OAuth redirect URL, including custom schemes like cursor://.
 * Some browsers ignore window.location.assign for non-http(s) protocols.
 */
function navigateToOAuthRedirect(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  try {
    window.location.assign(url);
  } catch {
    // Custom-scheme navigations can throw in some browsers; the anchor click is the fallback.
  }
}

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get('authorization_id');
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [continueUrl, setContinueUrl] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function load() {
      if (!authorizationId) {
        setError('Missing authorization request.');
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        window.location.assign(buildOAuthConsentAuthRedirect(authorizationId));
        return;
      }

      try {
        setDetails(await getAuthorizationDetails(asConsentClient(supabase), authorizationId));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load this request.');
      }
    }

    void load();
  }, [authorizationId, supabase]);

  async function decide(approved: boolean) {
    if (!authorizationId) return;
    setBusy(true);
    setError(null);
    try {
      const consentClient = asConsentClient(supabase);
      const redirect = approved
        ? await approveAuthorization(consentClient, authorizationId)
        : await denyAuthorization(consentClient, authorizationId);

      // Keep a manual continue link visible. Cursor uses cursor:// callbacks that
      // browsers often block after async work, which leaves the client stuck on
      // "Exchanging token...".
      setContinueUrl(redirect);
      navigateToOAuthRedirect(redirect);
      setBusy(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authorization failed.');
      setBusy(false);
    }
  }

  const clientName =
    details?.client?.client_name ?? details?.client?.name ?? 'An MCP client';
  const scopes = details?.scope?.split(/\s+/).filter(Boolean) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-8 flex justify-center">
        <ViewBaitLogo className="h-10 w-auto" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Connect {clientName}?</CardTitle>
          <CardDescription>
            This lets the client use ViewBait as you. Your existing database permissions and
            Row Level Security still apply.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {scopes.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Requested identity access: {scopes.join(', ')}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {continueUrl ? (
            <div className="space-y-3 rounded-md border border-border p-3">
              <p className="text-sm text-muted-foreground">
                Approval recorded. If your app is still stuck on &quot;Exchanging token…&quot;, open
                this link to finish the handoff:
              </p>
              <Button asChild className="w-full">
                <a href={continueUrl}>Continue to {clientName}</a>
              </Button>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <Button type="button" disabled={busy || !details} onClick={() => void decide(true)}>
                Allow
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || !details}
                onClick={() => void decide(false)}
              >
                Deny
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export default function OAuthConsentPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading authorization…</p>
        </main>
      }
    >
      <OAuthConsentContent />
    </Suspense>
  );
}
