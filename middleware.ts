/**
 * Next.js Middleware
 *
 * Handles authentication checks and route protection.
 * Runs on every request matching the configured routes.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Routes that require authentication
 */
const PROTECTED_ROUTES = ["/studio", "/onboarding"];

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

export async function middleware(request: NextRequest) {
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

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected route check - redirect to auth if not authenticated
  if (isProtectedRoute(pathname) && !user) {
    const redirectUrl = new URL("/auth", request.url);
    // Preserve the original destination for post-auth redirect
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Auth route check - redirect authenticated users to studio
  // Skip this for reset-password and callback routes
  if (
    isAuthRoute(pathname) &&
    user &&
    !pathname.includes("/reset-password") &&
    !pathname.includes("/callback")
  ) {
    const redirectTo = request.nextUrl.searchParams.get("redirect") || "/studio";
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Studio route: redirect to onboarding if user has not completed onboarding
  if (user && isStudioRoute(pathname) && !isOnboardingRoute(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    const needsOnboarding =
      !profile || profile.onboarding_completed === false;

    if (needsOnboarding) {
      const redirectUrl = new URL("/onboarding", request.url);
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
