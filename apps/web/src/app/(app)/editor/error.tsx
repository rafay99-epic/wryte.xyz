"use client";

import { fadeSlideUp, smoothTransition } from "@wryte/logic/lib/motion";
import { cn } from "@wryte/logic/lib/utils";
import { Button, buttonVariants } from "@wryte/ui/button";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Error boundary for the editor route.
 *
 * Renders within the app shell so the sidebar + header stay visible.
 * Provides editor-specific messaging and navigation options.
 */
export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[EditorError]", error);
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
          Editor error
        </h2>
        <p className="mb-1 text-sm text-muted-foreground">
          The editor ran into an unexpected error.
        </p>
        <p className="mb-2 text-sm text-muted-foreground">
          Your work may have been auto-saved.
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
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Back to project
          </Button>
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
