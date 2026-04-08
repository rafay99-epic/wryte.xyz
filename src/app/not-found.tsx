"use client";

import { motion } from "framer-motion";
import { ArrowLeft, FileQuestion, Home } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Global 404 page — rendered when no route matches the requested URL.
 *
 * Uses the root layout (providers, fonts, theme) but renders its own
 * centered content with navigation options back to safety.
 */
export default function NotFound() {
  const router = useRouter();

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
        <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl bg-muted/60">
          <FileQuestion className="size-10 text-muted-foreground" />
        </div>

        {/* Heading */}
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-foreground">
          404
        </h1>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Check the URL or head back to familiar territory.
        </p>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => router.back()}
            className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
          >
            <ArrowLeft className="size-4" />
            Go back
          </button>
          <Link href="/dashboard" className={cn(buttonVariants(), "gap-2")}>
            <Home className="size-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
