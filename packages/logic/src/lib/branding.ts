export type BrandAsset = string | { light: string; dark: string };

export const BRAND = {
  name: "Wryte",

  shortName: "wryte",

  icon: {
    light: "/wryte-icon.png",
    dark: "/wryte-icon-dark.png",
  } as BrandAsset,
} as const;

export function resolveBrandAsset(
  asset: BrandAsset,
  theme: "light" | "dark" = "light",
): string {
  return typeof asset === "string" ? asset : asset[theme];
}
