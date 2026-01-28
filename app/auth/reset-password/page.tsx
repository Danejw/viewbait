"use client";

/**
 * Password Reset Page
 * 
 * Allows users to set a new password after clicking the reset link in their email.
 */

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaseCard from "@/app/components/BaseCard";
import BaseButton from "@/app/components/BaseButton";
import BaseInput from "@/app/components/BaseInput";
import { useAuth } from "@/lib/hooks/useAuth";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePassword, isAuthenticated } = useAuth();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !searchParams.get("code")) {
      router.push("/studio");
    }
  }, [isAuthenticated, router, searchParams]);

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
      <BaseCard padding="lg" className="w-full max-w-md">
        <h1 className="mb-6 text-2xl font-bold font-display text-foreground">
          Reset Password
        </h1>

        {success ? (
          <div className="space-y-4">
            <p className="text-primary">
              Password updated successfully! Redirecting...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <BaseInput
              id="password"
              type="password"
              label="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              disabled={loading}
              variant="inset"
              size="md"
            />

            <BaseInput
              id="confirmPassword"
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              disabled={loading}
              variant="inset"
              size="md"
            />

            <BaseButton
              type="submit"
              variant="primary"
              size="md"
              disabled={loading}
              className="w-full"
            >
              {loading ? "Updating..." : "Update Password"}
            </BaseButton>
          </form>
        )}
      </BaseCard>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div>Loading...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
