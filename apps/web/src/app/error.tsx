"use client";

import { fadeSlideUp, smoothTransition } from "@wryte/logic/lib/motion";
import { cn } from "@wryte/logic/lib/utils";
import { Button, buttonVariants } from "@wryte/ui/button";
import { motion } from "framer-motion";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * Root error boundary — catches unhandled errors across the entire app.
 *
 * Next.js renders this component when a runtime error occurs in any
 * page or layout beneath the root layout. It receives the error and a
 * `reset` function that re-renders the failed segment.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Log the error for debugging (production errors include a digest)
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mx-auto max-w-md text-center"
      >
        {/* Icon */}
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-10 text-destructive" />
        </div>

        {/* Heading */}
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h1>
        <p className="mb-2 text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred. You can try again or head back to the
          dashboard.
        </p>

        {/* Error details (development only) */}
        {error.message && process.env.NODE_ENV === "development" && (
          <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-left">
            <p className="font-mono text-xs text-destructive">
              {error.message}
            </p>
            {error.digest && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                Digest: {error.digest}
              </p>
            )}
          </div>
        )}

        {!error.message || process.env.NODE_ENV !== "development" ? (
          <div className="mb-6" />
        ) : null}

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Link href="/dashboard" className={cn(buttonVariants(), "gap-2")}>
            <Home className="size-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
