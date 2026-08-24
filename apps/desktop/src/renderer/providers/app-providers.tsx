import { convex } from "@wryte/logic/lib/convex";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { type ReactNode, useCallback } from "react";
import { useNavigate } from "react-router";
import { DesktopChrome } from "@/components/layout/desktop-chrome";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ClerkProvider, useAuth } from "../shims/clerk-nextjs";

const SIGN_IN_URL = "/sign-in";
const SIGN_UP_URL = "/sign-up";

/**
 * Root providers for the desktop renderer. Mirrors the web app's
 * `components/providers/convex-provider.tsx` one to one:
 *
 * 1. **ClerkProvider** — client-side auth context with the same redirect
 *    targets as the website.
 * 2. **ConvexProviderWithClerk** — bridges Clerk JWTs into Convex so server
 *    functions see the identity via `ctx.auth.getUserIdentity()`.
 *
 * Theme + TanStack Query providers are reused straight from web sources via
 * the bundler alias, as is the desktop chrome (title bar / offline banner).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const routerPush = useCallback((to: string) => navigate(to), [navigate]);
  const routerReplace = useCallback(
    (to: string) => navigate(to, { replace: true }),
    [navigate],
  );

  return (
    <ClerkProvider
      publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ?? ""}
      routerPush={routerPush}
      routerReplace={routerReplace}
      signInUrl={SIGN_IN_URL}
      signUpUrl={SIGN_UP_URL}
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <QueryProvider>
          <ThemeProvider>
            <DesktopChrome />
            {children}
          </ThemeProvider>
        </QueryProvider>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
