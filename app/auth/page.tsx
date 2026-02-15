"use client";

/**
 * Auth Page
 *
 * Combined sign-in and sign-up page with tab navigation.
 * Redirects authenticated users to the studio.
 * Uses the same header and footer as the root landing page.
 * FeedbackModal is lazy-loaded and only mounted when user opens Contact (reduces initial bundle/TBT).
 */

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { useAuth } from "@/lib/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAllowedRedirect } from "@/lib/utils/redirect-allowlist";
import { track } from "@/lib/analytics/track";

/** Lazy-load FeedbackModal (Dialog/sonner) so auth first paint and LCP are not delayed. */
const FeedbackModalLazy = dynamic(
  () => import("@/components/feedback-modal").then((m) => ({ default: m.FeedbackModal })),
  { ssr: false }
);

/**
 * Google Icon SVG Component
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/**
 * Auth Form Component
 * Handles both sign-in and sign-up with tab navigation
 */
function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, signInWithGoogle, isAuthenticated, isLoading: authLoading } = useAuth();

  // All hooks must run unconditionally before any return (Rules of Hooks)
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Get the redirect destination from query params; validate to prevent open redirect
  const redirectTo = getAllowedRedirect(searchParams.get("redirect"), "/studio");

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, authLoading, router, redirectTo]);

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ViewBaitLogo className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If authenticated, show loading while redirecting
  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <ViewBaitLogo className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Redirecting to studio...</p>
        </div>
      </div>
    );
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message || "Failed to sign in");
      } else {
        track("sign_in");
        // Redirect will happen automatically via useEffect
        router.push(redirectTo);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

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
      const { error } = await signUp(email, password, {
        full_name: fullName || undefined,
      });

      if (error) {
        setError(error.message || "Failed to create account");
      } else {
        // Apply referral code if provided (don't block signup on failure)
        if (referralCode.trim()) {
          try {
            await fetch("/api/referrals/apply", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code: referralCode.trim().toUpperCase() }),
            });
          } catch (err) {
            console.error("Failed to apply referral code:", err);
          }
        }
        setMessage("Account created successfully! Redirecting...");
        setTimeout(() => {
          router.push(redirectTo);
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // Pass the redirect URL to Google OAuth
      const { error } = await signInWithGoogle(redirectTo);
      if (error) {
        setError(error.message || "Failed to sign in with Google");
        setLoading(false);
      } else {
        track("sign_in");
      }
      // If successful, Google OAuth will redirect the user
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    // Navigate to forgot password flow
    router.push("/auth/forgot-password");
  };

  const handleNavClick = () => setMenuOpen(false);

  return (
    <div
      className="landing-page min-h-screen flex flex-col bg-background text-foreground"
    >
      {/* Mobile menu overlay */}
      <div
        className={`mobile-menu-overlay ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
        role="button"
        tabIndex={0}
        aria-label="Close menu"
      />

      {/* Mobile menu */}
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
        <nav style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {["Product", "Pricing", "Creators"].map((link) => (
            <Link
              key={link}
              href={`/#${link.toLowerCase()}`}
              onClick={handleNavClick}
              className="crt-text"
              style={{
                color: "#999",
                textDecoration: "none",
                fontSize: "18px",
                fontWeight: 600,
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {link}
            </Link>
          ))}
          <Link
            href="/studio"
            onClick={handleNavClick}
            className="btn-crt"
            style={{
              marginTop: "16px",
              padding: "16px 24px",
              background: "#ff0000",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              textAlign: "center",
              textDecoration: "none",
              display: "block",
            }}
          >
            Open Studio
          </Link>
        </nav>
      </div>

      {/* Navigation – same as root landing */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          padding: "16px var(--landing-padding-x)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(3,3,3,0.95)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255,255,255,0.03)",
          transition: "all 0.4s ease",
        }}
      >
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "#ff0000",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              boxShadow: "0 0 30px rgba(255,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.1)",
            }}
          >
            <div className="crop-mark tl" style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }} />
            <div className="crop-mark br" style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span
              className="crt-text-heavy"
              style={{
                fontSize: "18px",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                display: "block",
                lineHeight: 1,
              }}
            >
              VIEWBAIT
            </span>
            <span
              className="mono hide-mobile crt-text"
              style={{
                fontSize: "9px",
                color: "#555",
                letterSpacing: "0.1em",
              }}
            >
              THUMBNAIL STUDIO
            </span>
          </div>
        </Link>

        <div className="landing-nav-links hide-mobile" style={{ alignItems: "center", gap: "40px" }}>
          {["Product", "Pricing", "Creators"].map((link) => (
            <Link
              key={link}
              href={`/#${link.toLowerCase()}`}
              className="crt-text"
              style={{
                color: "#666",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,
                position: "relative",
                padding: "8px 0",
              }}
            >
              {link}
            </Link>
          ))}
          <Link
            href="/studio"
            className="btn-crt"
            style={{
              padding: "12px 24px",
              background: "#fff",
              border: "none",
              borderRadius: "10px",
              color: "#000",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Open Studio
          </Link>
        </div>

        <button
          type="button"
          className="hide-desktop"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          style={{
            width: "44px",
            height: "44px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: "18px",
              height: "2px",
              background: "#fff",
              borderRadius: "2px",
              transition: "all 0.3s ease",
              transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none",
              boxShadow: "0 0 4px rgba(255,0,0,0.5)",
            }}
          />
          <span
            style={{
              width: "18px",
              height: "2px",
              background: "#fff",
              borderRadius: "2px",
              opacity: menuOpen ? 0 : 1,
              transition: "all 0.3s ease",
            }}
          />
          <span
            style={{
              width: "18px",
              height: "2px",
              background: "#fff",
              borderRadius: "2px",
              transition: "all 0.3s ease",
              transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none",
              boxShadow: "0 0 4px rgba(255,0,0,0.5)",
            }}
          />
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex flex-1 items-center justify-center px-4 py-12 pt-24">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Welcome to ViewBait</CardTitle>
            <CardDescription>
              {activeTab === "signin"
                ? "Sign in to access your thumbnail studio"
                : "Create an account to start generating thumbnails"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as "signin" | "signup");
                setError(null);
                setMessage(null);
              }}
              className="w-full"
            >
              <TabsList className="mb-6 w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Sign Up
                </TabsTrigger>
              </TabsList>

              {/* Error/Message Display */}
              {error && (
                <div className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 p-3 text-sm text-primary">
                  {message}
                </div>
              )}

              {/* Sign In Form */}
              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      data-testid="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={handleForgotPassword}
                        className="text-xs text-muted-foreground h-auto p-0"
                      >
                        Forgot password?
                      </Button>
                    </div>
                    <Input
                      id="signin-password"
                      data-testid="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="current-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading} data-testid="login-submit">
                    {loading ? (
                      <>
                        <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Sign in with Email
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Sign Up Form */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name (optional)</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must be at least 8 characters
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      disabled={loading}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-referral">Referral Code (optional)</Label>
                    <Input
                      id="signup-referral"
                      type="text"
                      placeholder="ABCD1234"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      maxLength={12}
                      disabled={loading}
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? (
                      <>
                        <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              {/* Google OAuth */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                onClick={handleGoogleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="mr-2 h-4 w-4" />
                )}
                Continue with Google
              </Button>
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Footer – same as root landing */}
      <footer
        style={{
          padding: "32px var(--landing-padding-x)",
          borderTop: "1px solid rgba(255,255,255,0.03)",
        }}
      >
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <Link
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                width: "28px",
                height: "28px",
                background: "#ff0000",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(255,0,0,0.4)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="crt-text-heavy" style={{ fontSize: "14px", fontWeight: 800 }}>
              VIEWBAIT
            </span>
          </Link>

          <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <Link
              href="/legal/privacy"
              className="crt-text"
              style={{
                color: "#444",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.2s",
              }}
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="crt-text"
              style={{
                color: "#444",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.2s",
              }}
            >
              Terms
            </Link>
            <button
              type="button"
              className="crt-text cursor-pointer border-0 bg-transparent p-0 font-inherit"
              style={{
                color: "#444",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.2s",
              }}
              onClick={() => setFeedbackOpen(true)}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#888"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#444"; }}
              aria-label="Open feedback form"
            >
              Contact
            </button>
          </div>

          <div className="mono crt-text" style={{ color: "#333", fontSize: "11px", letterSpacing: "0.05em" }}>
            © {new Date().getFullYear()} VIEWBAIT
          </div>
        </div>
        {feedbackOpen && (
          <FeedbackModalLazy open onClose={() => setFeedbackOpen(false)} />
        )}
      </footer>
    </div>
  );
}

/**
 * Auth Page with Suspense boundary for useSearchParams
 */
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <ViewBaitLogo className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
