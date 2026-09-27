"use client";

import { useResolvedTheme } from "@wryte/logic/hooks/use-resolved-theme";
import { BRAND, resolveBrandAsset } from "@wryte/logic/lib/branding";
import Image, { type ImageProps } from "next/image";

type Props = Omit<ImageProps, "src" | "alt"> & {
  alt?: string;
};

export function BrandIcon({ alt, ...props }: Props) {
  const theme = useResolvedTheme();
  const src = resolveBrandAsset(BRAND.icon, theme);
  return <Image src={src} alt={alt ?? BRAND.name} {...props} />;
}
