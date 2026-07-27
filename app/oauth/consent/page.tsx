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
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

function OAuthConsentContent() {
  const searchParams = useSearchParams();
  const authorizationId = searchParams.get('authorization_id');
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
        setDetails(await getAuthorizationDetails(supabase, authorizationId));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load this request.');
      }
    }

    void load();
  }, [authorizationId, supabase]);

  async function decide(approved: boolean) {
    if (!authorizationId) return;
    setBusy(true);
    try {
      const redirect = approved
        ? await approveAuthorization(supabase, authorizationId)
        : await denyAuthorization(supabase, authorizationId);
      window.location.assign(redirect);
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
