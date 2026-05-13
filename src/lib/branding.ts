/**
 * Central brand asset registry.
 *
 * To swap the logo, replace the file at `BRAND.icon` (or change the path here).
 * Every reference in the app reads from this object, so a single change
 * propagates to the header, sidebar, marketing pages, favicon, OG image,
 * PWA manifest, and JSON-LD structured data.
 *
 * For light/dark variants later, switch any field to a `{ light, dark }`
 * object and resolve it via `resolveBrandAsset()` (or `<BrandIcon />` in
 * client UI).
 */

export type BrandAsset = string | { light: string; dark: string };

export const BRAND = {
  /** Display name — used in alt text, copy, and structured data. */
  name: "Wryte",

  /** Lowercase wordmark form — used in inline brand lockups. */
  shortName: "wryte",

  /**
   * Primary square brand icon. Per-theme variants — client UI swaps
   * automatically via <BrandIcon />; server-rendered contexts (metadata,
   * manifest) use the `light` variant.
   *
   * Used in:
   *   • Marketing header, hero, footer
   *   • Sidebar product header
   *   • Sign-in / sign-up pages
   *   • Favicon, apple-touch-icon
   *   • PWA manifest icons
   *   • OpenGraph / Twitter card / JSON-LD logo
   */
  icon: {
    light: "/wryte-icon.png",
    dark: "/wryte-icon-dark.png",
  } as BrandAsset,
} as const;

/**
 * Resolve a brand asset to a single URL string.
 *
 * Pass `theme` to pick a variant; defaults to `light` which is the safe
 * choice for server-rendered contexts (metadata, manifest) where no
 * theme is available.
 */
export function resolveBrandAsset(
  asset: BrandAsset,
  theme: "light" | "dark" = "light",
): string {
  return typeof asset === "string" ? asset : asset[theme];
}
