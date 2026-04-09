import type { MetadataRoute } from "next";

/**
 * Generates the `/sitemap.xml` file at build time.
 *
 * Only public, indexable pages are included. Authenticated routes
 * (dashboard, editor, projects, settings) are intentionally excluded
 * because their content is user-specific and gated behind auth.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://wryte.xyz";
  const now = new Date();

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
