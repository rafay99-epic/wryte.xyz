"use client";

import { useResolvedTheme } from "@wryte/logic/hooks/use-resolved-theme";
import { BRAND, resolveBrandAsset } from "@wryte/logic/lib/branding";
import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src" | "alt"> & {
  alt?: string;
};

/**
 * Theme-aware brand icon. Reads `BRAND.icon` from the central registry and
 * resolves the per-theme variant on the client. Drop-in replacement for
 * `<Image src="/wryte-icon.png" />`.
 */
export function BrandIcon({ alt, ...props }: Props) {
  const theme = useResolvedTheme();
  const src = resolveBrandAsset(BRAND.icon, theme);
  return <Image src={src} alt={alt ?? BRAND.name} {...props} />;
}
