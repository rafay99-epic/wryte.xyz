"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { convex } from "@wryte/logic/lib/convex";
import { ConvexProviderWithClerk } from "convex/react-clerk";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
