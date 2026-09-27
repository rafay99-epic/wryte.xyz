"use client";

import { useResolvedTheme } from "@wryte/logic/hooks/use-resolved-theme";
import type { Mermaid } from "mermaid";
import { useEffect, useId, useRef, useState } from "react";

let mermaidPromise: Promise<Mermaid> | null = null;

function loadMermaid(): Promise<Mermaid> {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((mod) => {
      const mermaid = mod.default;
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

  if (svg === null && error === null) {
    return (
      <div className="not-prose my-6 flex justify-center py-8 text-sm text-muted-foreground/40">
        Rendering diagram…
      </div>
    );
  }

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
