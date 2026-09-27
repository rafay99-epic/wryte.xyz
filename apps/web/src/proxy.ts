import { clerkMiddleware } from "@clerk/nextjs/server";
import { APP_ROUTE_PREFIXES, AUTH_ROUTE_PREFIXES } from "@wryte/logic/lib/seo";
import { NextResponse } from "next/server";

function matchesRoutePrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function matchesAnyRoutePrefix(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some((prefix) => matchesRoutePrefix(pathname, prefix));
}

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const pathname = req.nextUrl.pathname;

  if (userId && matchesAnyRoutePrefix(pathname, AUTH_ROUTE_PREFIXES)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (matchesAnyRoutePrefix(pathname, APP_ROUTE_PREFIXES)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|__nextjs_font|sitemap\\.xml|robots\\.txt|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|xml|txt)).*)",
    "/api(.*)",
  ],
};
