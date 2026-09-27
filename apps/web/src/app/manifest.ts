import { BRAND, resolveBrandAsset } from "@wryte/logic/lib/branding";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from "@wryte/logic/lib/seo";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait-primary",
    categories: ["developer tools", "productivity", "writing"],
    icons: [
      {
        src: resolveBrandAsset(BRAND.icon),
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: resolveBrandAsset(BRAND.icon),
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: resolveBrandAsset(BRAND.icon),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
