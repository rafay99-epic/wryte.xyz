"use client";

import {
  getMediaProvider,
  type MediaProvider,
  type MediaProviderIconName,
} from "@wryte/logic/types/media";
import { Cloud, GitBranch, HardDrive, UploadCloud } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * The one place a storage provider becomes a glyph.
 *
 * Keyed by the registry's icon *name*, not by provider id, so adding a provider
 * that reuses an existing glyph ("bucket" for any S3-compatible store, say)
 * needs no change here at all. The map is exhaustive over
 * {@link MediaProviderIconName}, so introducing a genuinely new glyph is a
 * compile error in this file rather than a blank space in four others.
 */
const ICONS: Record<MediaProviderIconName, IconComponent> = {
  repo: GitBranch,
  upload: UploadCloud,
  cloud: Cloud,
  bucket: HardDrive,
};

export function getMediaProviderIcon(provider: MediaProvider): IconComponent {
  return ICONS[getMediaProvider(provider).icon];
}

/** Renders a provider's glyph. Pass `className` for sizing. */
export function MediaProviderIcon({
  provider,
  className,
}: {
  provider: MediaProvider;
  className?: string;
}) {
  const Icon = getMediaProviderIcon(provider);
  return <Icon className={className} />;
}
