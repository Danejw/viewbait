"use client";

/**
 * Password Reset Page
 *
 * Allows users to set a new password after clicking the reset link in their email.
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/hooks/useAuth";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePassword, isAuthenticated } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect already authenticated users
  useEffect(() => {
    if (isAuthenticated && !searchParams.get("code")) {
      router.push("/studio");
    }
  }, [isAuthenticated, router, searchParams]);

  useEffect(() => {
    emitTourEvent("tour.event.route.ready", {
      routeKey: "auth.reset",
      anchorsPresent: ["tour.auth.reset.form.input.newPassword", "tour.auth.reset.form.input.confirmPassword"],
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await updatePassword(password);

      if (updateError) {
        setError(updateError.message || "Failed to update password");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/studio");
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="mb-6 text-2xl font-bold font-display text-foreground">
            Reset Password
          </h1>

          {success ? (
            <div className="space-y-4">
              <p className="text-primary">
                Password updated successfully! Redirecting...
              </p>
              <Button variant="outline" className="w-full" asChild>
                <a href="/auth" data-tour="tour.auth.reset.state.link.backToSignin">Back to Sign In</a>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  data-tour="tour.auth.reset.form.input.newPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  data-tour="tour.auth.reset.form.input.confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="new-password"
                />
              </div>

              <Button
                type="submit"
                data-tour="tour.auth.reset.form.btn.submit"
                variant="default"
                size="lg"
                disabled={loading}
                className="w-full"
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div>Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
