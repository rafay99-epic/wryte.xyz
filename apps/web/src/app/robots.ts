import {
  BLOCKED_BOTS,
  LLM_BOTS,
  PRIVATE_ROUTE_PATTERNS,
  SITE_URL,
} from "@wryte/logic/lib/seo";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const disallow = [...PRIVATE_ROUTE_PATTERNS];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...LLM_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow,
      })),
      ...BLOCKED_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
