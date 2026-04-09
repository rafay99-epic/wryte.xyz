import type { MetadataRoute } from "next";

/**
 * Generates the `/robots.txt` file at build time.
 *
 * - Allows all crawlers full access to public pages.
 * - Blocks crawling of authenticated app routes (`/dashboard`, `/editor`,
 *   `/projects`, `/settings`) since their content is user-specific and
 *   should not be indexed.
 * - Points crawlers to the XML sitemap for efficient discovery.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://wryte.xyz";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/dashboard",
          "/dashboard/*",
          "/editor",
          "/editor/*",
          "/projects",
          "/projects/*",
          "/settings",
          "/settings/*",
          "/sign-in",
          "/sign-in/*",
          "/sign-up",
          "/sign-up/*",
          "/api/*",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
