/**
 * Shared framer-motion animation variants and transition presets.
 *
 * Every animated component imports from here so timing, easing,
 * and stagger values stay consistent across the app.
 */
import type { Transition, Variants } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Transitions                                                        */
/* ------------------------------------------------------------------ */

/** Snappy spring for layout animations (sidebar indicator, expanding panels). */
export const springTransition: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 30,
};

/** General-purpose smooth ease for fades and slides. */
export const smoothTransition: Transition = {
  duration: 0.2,
  ease: [0.25, 0.1, 0.25, 1],
};

/** Slightly longer ease for page-level transitions. */
export const pageTransition: Transition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

/* ------------------------------------------------------------------ */
/*  Variants                                                           */
/* ------------------------------------------------------------------ */

/** Simple opacity crossfade. */
export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Fade in with a subtle upward slide — the primary page/card entrance. */
export const fadeSlideUp: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/** Downward slide for dropdowns and popovers. */
export const fadeSlideDown: Variants = {
  initial: { opacity: 0, y: -4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

/** Slide in from the left — sidebar content entrance. */
export const slideInFromLeft: Variants = {
  initial: { opacity: 0, x: -12 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
};

/** Scale up from 95% — dialog/modal entrance. */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 8 },
};

/* ------------------------------------------------------------------ */
/*  Stagger helpers                                                    */
/* ------------------------------------------------------------------ */

/** Parent container that staggers children on enter. */
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
};

/** Each staggered child: fades up. */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};
