import { PUBLIC_ROUTES, SITE_URL } from "@wryte/logic/lib/seo";
import type { MetadataRoute } from "next";
import { DOC_PAGES } from "@/features/docs/registry";

/**
 * Generates `/sitemap.xml` at build time. Sourced from `PUBLIC_ROUTES` in
 * `@wryte/logic/lib/seo` (shared with robots.txt) plus every MCP doc page
 * from the docs registry.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = PUBLIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path === "/" ? "" : route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
  const docs: MetadataRoute.Sitemap = DOC_PAGES.map((page) => ({
    url: `${SITE_URL}/docs/${page.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));
  return [...routes, ...docs];
}
