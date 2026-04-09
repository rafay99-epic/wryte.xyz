import type { MetadataRoute } from "next";

/**
 * Generates `/manifest.webmanifest` — the PWA / installable-app manifest.
 *
 * Provides browser install prompts, Android home-screen icons, and
 * theming metadata. The `start_url` points to `/dashboard` since that
 * is the primary logged-in experience.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wryte – Write Now, Publish Later",
    short_name: "Wryte",
    description:
      "An editor-first content workflow tool for developers. Capture rough ideas, refine them with AI, and publish to GitHub when ready.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    categories: ["developer tools", "productivity", "writing"],
    icons: [
      {
        src: "/wryte-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/wryte-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
