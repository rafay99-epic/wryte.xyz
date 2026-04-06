// NOTE: Next.js 16 deprecated the middleware.ts convention in favor of proxy.ts.
// However, @clerk/nextjs only supports middleware.ts — migration is blocked until
// Clerk releases a proxy.ts adapter. The deprecation warning is non-blocking.
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Routes that require authentication — unauthenticated visitors are
 * redirected to the sign-in page via `auth.protect()`.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/editor(.*)",
  "/projects(.*)",
  "/settings(.*)",
]);

/**
 * Public / auth-related routes where signed-in users should NOT linger.
 * If an authenticated user hits one of these, they are redirected to /dashboard
 * to avoid a confusing "sign in again" UX.
 */
const isPublicAuthRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

/**
 * Clerk-powered middleware that enforces two rules on every matched request:
 *
 * 1. **Authenticated users on public/auth pages** — redirect to /dashboard so they
 *    don't see the landing or sign-in page after already logging in.
 * 2. **Unauthenticated users on protected pages** — `auth.protect()` triggers
 *    Clerk's built-in redirect to the sign-in flow.
 */
export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Rule 1: Redirect signed-in users away from landing/auth pages to dashboard
  if (userId && isPublicAuthRoute(req)) {
    const dashboardUrl = new URL("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Rule 2: Protect app routes — redirect unauthenticated users to sign-in
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

/**
 * Next.js matcher config — controls which requests pass through this middleware.
 *
 * The first pattern excludes static assets (_next, images, fonts, etc.) to
 * avoid unnecessary auth checks on files that never need protection.
 * The second pattern ensures API and tRPC routes are always checked.
 */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
