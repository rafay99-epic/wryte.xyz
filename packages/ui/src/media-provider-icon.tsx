"use client";

import {
  getMediaProvider,
  type MediaProvider,
  type MediaProviderIconName,
} from "@wryte/logic/types/media";
import { Cloud, GitBranch, HardDrive, UploadCloud } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

const ICONS: Record<MediaProviderIconName, IconComponent> = {
  repo: GitBranch,
  upload: UploadCloud,
  cloud: Cloud,
  bucket: HardDrive,
};

export function getMediaProviderIcon(provider: MediaProvider): IconComponent {
  return ICONS[getMediaProvider(provider).icon];
}

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
