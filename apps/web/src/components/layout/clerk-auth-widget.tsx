"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

function ClerkAuthFallback() {
  return (
    <div
      className="flex min-h-[28rem] w-full max-w-[25rem] animate-pulse items-center justify-center rounded-xl border border-border bg-card shadow-xl"
      role="status"
      aria-label="Loading authentication form"
    >
      <span className="sr-only">Loading authentication form</span>
    </div>
  );
}

function ClerkSignInContent() {
  return <SignIn />;
}

export function ClerkSignIn() {
  return (
    <Suspense fallback={<ClerkAuthFallback />}>
      <ClerkSignInContent />
    </Suspense>
  );
}

function ClerkSignUpContent() {
  return <SignUp />;
}

export function ClerkSignUp() {
  return (
    <Suspense fallback={<ClerkAuthFallback />}>
      <ClerkSignUpContent />
    </Suspense>
  );
}
