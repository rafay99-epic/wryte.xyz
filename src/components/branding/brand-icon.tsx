"use client";

import Image, { type ImageProps } from "next/image";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { BRAND, resolveBrandAsset } from "@/lib/branding";

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
