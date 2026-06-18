"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { EmbedLoader } from "../../../convex/integrations/oembedProviders";

/**
 * Widget-loader manager. Each loader (Twitter, TikTok, …) gets its own
 * promise keyed by script id. The script is injected once; subsequent
 * embeds wait on the same in-flight promise, then trigger a re-render via
 * the loader's `render` callback once its global reports ready.
 */
const loaderPromises = new Map<string, Promise<void>>();

function loadLoader(loader: EmbedLoader): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (loader.isReady()) return Promise.resolve();
  const existing = loaderPromises.get(loader.scriptId);
  if (existing) return existing;

  const promise = new Promise<void>((resolve) => {
    const script = document.getElementById(loader.scriptId);
    if (script) {
      // Script tag exists but global isn't ready yet — wait for its load.
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

/**
 * Renders a blockquote-based social embed (Twitter/X, TikTok) and hydrates it
 * into the interactive card via the provider's widget loader. The blockquote
 * markup comes from oEmbed (scripts stripped); the loader scans the element
 * and replaces it with the rendered card. `not-prose` keeps typography
 * styles off the embed.
 *
 * On first load the provider's bootstrapper usually renders any markup
 * already in the DOM; the explicit `render` call covers embeds added later
 * (the common case here, since embeds mount one-by-one as the user inserts
 * them or as the preview re-renders).
 */
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
