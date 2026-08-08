import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/articles",
  "/calendar",
  "/editor",
  "/projects",
  "/settings",
  "/admin",
] as const;

const PUBLIC_AUTH_ROUTE_PREFIXES = ["/sign-in", "/sign-up"] as const;

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesAnyRoutePrefix(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

/**
 * Next.js 16 request boundary. Clerk auth stays here so protected navigation
 * redirects before route rendering, while public routes remain cacheable.
 */
export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const pathname = req.nextUrl.pathname;

  if (userId && matchesAnyRoutePrefix(pathname, PUBLIC_AUTH_ROUTE_PREFIXES)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (matchesAnyRoutePrefix(pathname, PROTECTED_ROUTE_PREFIXES)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|__nextjs_font|sitemap\\.xml|robots\\.txt|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    "/(api|trpc)(.*)",
  ],
};
