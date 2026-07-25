"use client";

/**
 * Reusable framer-motion wrapper components that replace manual
 * skeleton → content transitions throughout the app.
 */

import {
  fadeIn,
  fadeSlideUp,
  pageTransition,
  smoothTransition,
  staggerContainer,
  staggerItem,
} from "@wryte/logic/lib/motion";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  PageTransition                                                     */
/* ------------------------------------------------------------------ */

type PageTransitionProps = {
  children: ReactNode;
};

/**
 * Wraps route content with a fadeSlideUp on enter and a
 * quick fade on exit. Key is derived from the current pathname
 * so every route change triggers the animation.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={fadeSlideUp}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  ContentReveal                                                      */
/* ------------------------------------------------------------------ */

type ContentRevealProps = {
  /** While true the fallback (skeleton) is shown; when false children fade in. */
  isLoading: boolean;
  /** Skeleton / placeholder UI. */
  fallback: ReactNode;
  children: ReactNode;
};

/**
 * Crossfades between a loading skeleton and the real content.
 * Replaces the repetitive `{isLoading ? <Skeleton/> : <Content/>}` pattern
 * with a smooth animated transition.
 */
export function ContentReveal({
  isLoading,
  fallback,
  children,
}: ContentRevealProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          variants={fadeIn}
          initial="animate"
          exit="exit"
          transition={smoothTransition}
        >
          {fallback}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={fadeIn}
          initial="initial"
          animate="animate"
          transition={smoothTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  StaggerList                                                        */
/* ------------------------------------------------------------------ */

type StaggerListProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Wraps a list of children so they animate in one-by-one
 * with a slight stagger delay. Each direct child should be
 * wrapped in a `motion.div` (or use `StaggerItem`).
 */
export function StaggerList({ children, className }: StaggerListProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className={className}
    >
      {children}
    </motion.div>
  );
}

type StaggerItemProps = {
  children: ReactNode;
  className?: string;
};

/** A single item inside a `StaggerList`. */
export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}
