"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { convex } from "@/lib/convex";

/**
 * Root authentication and data provider.
 *
 * Composes two providers that must be nested in a specific order:
 *
 * 1. **ClerkProvider** — Initialises Clerk's client-side auth context.
 *    Configures the sign-in/sign-up URLs and post-auth redirect targets
 *    so Clerk knows where to send users throughout the auth flow.
 *
 * 2. **ConvexProviderWithClerk** — Bridges Clerk's auth tokens into Convex
 *    so that every Convex query/mutation automatically carries the user's
 *    JWT. This means Convex server functions can call `ctx.auth.getUserIdentity()`
 *    without any extra client-side plumbing.
 *
 * Wrap the app layout with `<Providers>` to make both auth and real-time
 * data available to all descendant components.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      {/* ConvexProviderWithClerk reads Clerk's auth token via the useAuth hook
          and forwards it to the Convex client for authenticated requests */}
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
