"use client";

import { cn } from "@wryte/logic/lib/utils";

/**
 * Shared styled renderer for `<video>` tags in both the markdown and MDX
 * previews, mirroring the rounded look of preview images.
 */
export function VideoEmbed({
  className,
  ...props
}: React.VideoHTMLAttributes<HTMLVideoElement>) {
  return (
    <video
      controls
      preload="metadata"
      playsInline
      className={cn(
        "my-6 w-full max-w-full rounded-xl bg-black shadow-sm",
        className,
      )}
      {...props}
    />
  );
}
