"use client";

import { cn } from "@wryte/logic/lib/utils";
import Image from "next/image";
import { useState } from "react";

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
