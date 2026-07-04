"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";

/**
 * Client-side Mermaid renderer for ` ```mermaid ` fenced code blocks.
 *
 * Follows the same lazy-load discipline as `social-embed.tsx`: the `mermaid`
 * bundle (~500KB) is dynamically imported on first use and shared across every
 * diagram via a module-level promise, so it stays out of the main chunk and
 * off any page that has no diagrams.
 *
 * The diagram source stays plain text through the markdown pipeline
 * (rehype-sanitize never sees SVG); Mermaid produces the SVG here, after
 * sanitisation, with `securityLevel: "strict"` so its own output is sanitised.
 *
 * Rendering is debounced because the live editor preview re-renders on every
 * keystroke — partial/invalid syntax is the norm while typing, so the last
 * good SVG is kept on screen and transient parse errors are swallowed until
 * the source settles.
 */

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (
    id: string,
    text: string,
  ) => Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
};

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default as unknown as MermaidApi;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

const RENDER_DEBOUNCE_MS = 250;

type MermaidDiagramProps = {
  source: string;
};

export function MermaidDiagram({ source }: MermaidDiagramProps) {
  const rawId = useId();
  // `useId` yields colons, which are invalid in the DOM ids Mermaid derives.
  const baseId = `mermaid-${rawId.replace(/:/g, "")}`;
  const theme = useResolvedTheme();
  const seqRef = useRef(0);

  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = source.trim();
    if (!trimmed) {
      setSvg(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      // Prepend a theme directive unless the author set their own init block,
      // so diagrams follow the app's light/dark mode without global state.
      const themed = trimmed.includes("%%{init")
        ? trimmed
        : `%%{init: {'theme': '${theme === "dark" ? "dark" : "default"}'}}%%\n${trimmed}`;
      const renderId = `${baseId}-${seqRef.current++}`;

      void loadMermaid()
        .then((mermaid) => mermaid.render(renderId, themed))
        .then(({ svg: rendered }) => {
          if (cancelled) return;
          setSvg(rendered);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }, RENDER_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, theme, baseId]);

  // Nothing rendered yet and no error: first paint / empty source.
  if (svg === null && error === null) {
    return (
      <div className="not-prose my-6 flex justify-center py-8 text-sm text-muted-foreground/40">
        Rendering diagram…
      </div>
    );
  }

  // Hard failure with no previously-good render to fall back to.
  if (svg === null && error !== null) {
    return <MermaidError source={source} message={error} />;
  }

  return (
    <div className="not-prose my-6">
      {error !== null && (
        <p className="mb-2 text-xs text-amber-500">
          Diagram has a syntax error — showing the last valid render.
        </p>
      )}
      <div
        className="flex justify-center overflow-x-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg ?? "" }}
      />
    </div>
  );
}

function MermaidError({
  source,
  message,
}: {
  source: string;
  message: string;
}) {
  return (
    <div className="not-prose my-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="mb-2 text-xs font-medium text-destructive">
        Couldn’t render diagram
      </p>
      <p className="mb-3 font-mono text-xs text-destructive/70">{message}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 font-mono text-xs text-muted-foreground">
        {source}
      </pre>
    </div>
  );
}
