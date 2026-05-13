import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL } from "@/lib/seo";

/**
 * Generates `/sitemap.xml` at build time. Sourced from `PUBLIC_ROUTES` in
 * `src/lib/seo.ts` so the sitemap, llms.txt, and robots policy can't
 * drift apart.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path === "/" ? "" : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
