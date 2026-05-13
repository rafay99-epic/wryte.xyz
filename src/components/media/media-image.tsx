"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Image wrapper used inside the media library cards.
 *
 * Behaviour:
 *  - Renders a sliding shimmer placeholder beneath the image until it
 *    decodes, so the grid never shows a hard pop-in.
 *  - Fades the image in once `onLoad` fires.
 *  - Falls back to a small alt-text label if the source URL 404s.
 *
 * The parent provides the layout box (`position: relative` + fixed height);
 * this component fills it with `fill`.
 */
export function MediaImage({
  src,
  alt,
  sizes,
  className,
}: {
  src: string;
  alt: string;
  sizes?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <>
      {!loaded && !errored && (
        <div className="absolute inset-0 media-shimmer" aria-hidden="true" />
      )}
      {errored ? (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-muted-foreground/60">
          Failed to load
        </div>
      ) : (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes ?? "25vw"}
          className={cn(
            "object-contain p-2 transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
            className,
          )}
          loading="eager"
          unoptimized
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
    </>
  );
}
