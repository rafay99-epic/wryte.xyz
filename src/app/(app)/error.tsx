"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";

/**
 * Error boundary for the authenticated (app) route group.
 *
 * Renders within the app shell (sidebar + header remain visible) so
 * the user can navigate away or retry without a full-page reload.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-6">
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mx-auto max-w-sm text-center"
      >
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="mb-2 text-sm text-muted-foreground">
          This page ran into an unexpected error. Try refreshing or head back to
          the dashboard.
        </p>

        {error.message && process.env.NODE_ENV === "development" && (
          <div className="mb-5 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-left">
            <p className="font-mono text-xs text-destructive break-all">
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
          <div className="mb-5" />
        ) : null}

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="size-4" />
            Try again
          </Button>
          <Link href="/dashboard" className={cn(buttonVariants(), "gap-2")}>
            <LayoutDashboard className="size-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
