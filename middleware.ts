/**
 * Next.js Middleware
 *
 * Handles authentication checks and route protection.
 * Runs on every request matching the configured routes.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedRedirect } from "@/lib/utils/redirect-allowlist";

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = ["/studio", "/onboarding", "/e"];

/**
 * Routes that should redirect authenticated users away
 * (e.g., auth pages - logged in users don't need to see them)
 */
const AUTH_ROUTES = ["/auth"];

/**
 * Check if a path matches any of the protected routes
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Check if a path is an auth route
 */
function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * Check if path is /studio or /studio/*
 */
function isStudioRoute(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

/**
 * Check if path is /onboarding or /onboarding/*
 */
function isOnboardingRoute(pathname: string): boolean {
  return pathname === "/onboarding" || pathname.startsWith("/onboarding/");
}

/**
 * Public routes that do not require auth. Skip Supabase client and getSession()
 * to avoid Auth API usage and rate limits when these pages are hit often.
 */
function isPublicRoute(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/p/") || pathname.startsWith("/legal/");
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect /admin to studio admin view without loading the page component
  if (pathname === "/admin") {
    return NextResponse.redirect(new URL("/studio?view=admin", request.url));
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getSession() for redirect logic only to avoid Auth API round-trips on every request
  // (reduces 429 rate limit errors). Session user is not server-verified; we use it only
  // to decide redirects. Where we need a verified user (e.g. profile lookup), we call
  // getUser() in that branch. API routes and RLS enforce real auth.
  let hasSession = false;
  try {
    const { data } = await supabase.auth.getSession();
    hasSession = !!data.session?.user;
  } catch (err) {
    const authErr = err as { status?: number; code?: string };
    if (process.env.NODE_ENV === "development" && authErr?.status === 429) {
      console.warn("[middleware] Supabase Auth rate limit (429), treating as unauthenticated");
    }
  }

  // Protected route check - redirect to auth if not authenticated
  if (isProtectedRoute(pathname) && !hasSession) {
    const redirectUrl = new URL("/auth", request.url);
    const destination = pathname + (request.nextUrl.search || "");
    redirectUrl.searchParams.set("redirect", isAllowedRedirect(destination) ? destination : "/studio");
    return NextResponse.redirect(redirectUrl);
  }

  // Auth route check - redirect authenticated users to studio
  // Skip this for reset-password and callback routes
  if (
    isAuthRoute(pathname) &&
    hasSession &&
    !pathname.includes("/reset-password") &&
    !pathname.includes("/callback")
  ) {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/studio";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Studio route: redirect to onboarding if user has not completed onboarding.
  // Use getUser() here so we use a server-verified user for the profile lookup
  // (avoids Supabase warning about getSession() user not being authentic).
  if (hasSession && isStudioRoute(pathname) && !isOnboardingRoute(pathname)) {
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData.user?.id ?? null;
    } catch {
      userId = null;
    }
    if (!userId) {
      const redirectUrl = new URL("/auth", request.url);
      redirectUrl.searchParams.set("redirect", pathname + (request.nextUrl.search || ""));
      return NextResponse.redirect(redirectUrl);
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", userId)
      .single();

    const needsOnboarding =
      !profile || profile.onboarding_completed === false;

    if (needsOnboarding) {
      const redirectUrl = new URL("/onboarding", request.url);
      const destination = pathname + (request.nextUrl.search || "");
      if (isAllowedRedirect(destination)) {
        redirectUrl.searchParams.set("redirect", destination);
      }
      const redirectResponse = NextResponse.redirect(redirectUrl);
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse;
}

/**
 * Matcher configuration
 * Runs middleware on all routes except static files and API routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
