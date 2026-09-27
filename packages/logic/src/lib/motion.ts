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

/** General-purpose smooth ease for fades and slides. */
export const smoothTransition: Transition = {
  duration: 0.2,
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
