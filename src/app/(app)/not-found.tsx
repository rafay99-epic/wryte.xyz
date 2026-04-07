"use client";

import { motion } from "framer-motion";
import { FileQuestion, LayoutDashboard, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fadeSlideUp, smoothTransition } from "@/lib/motion";

/**
 * 404 page for the authenticated (app) route group.
 *
 * Renders within the app shell so the sidebar and header remain visible,
 * giving the user easy navigation back to valid pages.
 */
export default function AppNotFound() {
  const router = useRouter();

  return (
    <div className="flex h-full items-center justify-center p-6">
      <motion.div
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        transition={smoothTransition}
        className="mx-auto max-w-sm text-center"
      >
        <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl bg-muted/60">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          This page doesn&apos;t exist. It may have been moved or deleted.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Go back
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
