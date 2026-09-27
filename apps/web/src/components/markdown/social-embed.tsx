"use client";

import type { EmbedLoader } from "@wryte/backend/integrations/oembedProviders";
import { cn } from "@wryte/logic/lib/utils";
import { useEffect, useRef } from "react";

const loaderPromises = new Map<string, Promise<void>>();

function loadLoader(loader: EmbedLoader): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (loader.isReady()) return Promise.resolve();
  const existing = loaderPromises.get(loader.scriptId);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const script = document.getElementById(loader.scriptId);
    if (script) {
      script.addEventListener("load", () => resolve());
      return;
    }
    const el = document.createElement("script");
    el.id = loader.scriptId;
    el.src = loader.src;
    el.async = true;
    el.charset = "utf-8";
    el.addEventListener("load", () => resolve());
    document.body.appendChild(el);
  });
  loaderPromises.set(loader.scriptId, promise);
  return promise;
}

type SocialEmbedProps = React.ComponentPropsWithoutRef<"blockquote"> & {
  loader: EmbedLoader;
};

export function SocialEmbed({
  loader,
  children,
  className,
  ...props
}: SocialEmbedProps) {
  const ref = useRef<HTMLQuoteElement>(null);

  useEffect(() => {
    let cancelled = false;
    void loadLoader(loader).then(() => {
      if (cancelled) return;
      if (ref.current) loader.render(ref.current);
    });
    return () => {
      cancelled = true;
    };
  }, [loader]);

  return (
    <blockquote ref={ref} className={cn("not-prose", className)} {...props}>
      {children}
    </blockquote>
  );
}
