"use client";

import { compile } from "@mdx-js/mdx";
import { motion } from "framer-motion";
import React, {
  Component,
  createContext,
  type ErrorInfo,
  Fragment,
  forwardRef,
  memo,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import * as runtime from "react/jsx-runtime";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useEditorStore } from "@/stores/editor-store";
import { VideoEmbed } from "./video-embed";

type MdxModule = { default: React.ComponentType };
type MdxComponentProps = Record<string, unknown> & { children?: ReactNode };

const DEBOUNCE_MS = 300;

/* ------------------------------------------------------------------ */
/*  React scope — injected into compiled MDX so hooks/imports work     */
/* ------------------------------------------------------------------ */

const REACT_SCOPE = {
  React,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useContext,
  useReducer,
  useId,
  Fragment,
  createContext,
  forwardRef,
  memo,
  Suspense,
};

const SCOPE_PREAMBLE = [
  "const __scope = arguments[0].__scope;",
  "const React = __scope.React;",
  "const {useState,useEffect,useMemo,useCallback,useRef,useContext,useReducer,useId,Fragment,createContext,forwardRef,memo,Suspense} = __scope;",
].join("\n");

const REACT_IMPORT_RE = /^\s*import\b[\s\S]*?\bfrom\s+['"]react['"].*$/gm;

function stripReactImports(source: string): string {
  return source.replace(REACT_IMPORT_RE, "");
}

/* ------------------------------------------------------------------ */
/*  Unknown component placeholders                                     */
/* ------------------------------------------------------------------ */

function UnknownComponent({
  name,
  children,
}: {
  name: string;
  children?: ReactNode;
}) {
  return (
    <div className="my-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
      <span className="font-mono text-xs text-primary/70">
        &lt;{name} /&gt;
      </span>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

const unknownCache = new Map<string, React.ComponentType<MdxComponentProps>>();

function getPlaceholder(name: string): React.ComponentType<MdxComponentProps> {
  let comp = unknownCache.get(name);
  if (!comp) {
    comp = ({ children }: MdxComponentProps) => (
      <UnknownComponent name={name}>{children}</UnknownComponent>
    );
    unknownCache.set(name, comp);
  }
  return comp;
}

/* ------------------------------------------------------------------ */
/*  Styled component overrides for standard HTML elements              */
/* ------------------------------------------------------------------ */

const baseComponents: Record<string, React.ComponentType<MdxComponentProps>> = {
  video: (props: MdxComponentProps) => (
    <VideoEmbed {...(props as React.VideoHTMLAttributes<HTMLVideoElement>)} />
  ),
  img: ({ alt, src, ...props }: MdxComponentProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src as string}
      alt={(alt as string) ?? ""}
      className="my-6 max-w-full rounded-xl shadow-sm"
      loading="lazy"
      {...props}
    />
  ),
  a: ({ children, href, ...props }: MdxComponentProps) => (
    <a
      href={href as string}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary font-medium underline decoration-primary/30 underline-offset-[3px] transition-colors hover:decoration-primary/60"
      {...props}
    >
      {children}
    </a>
  ),
  pre: ({ children, ...props }: MdxComponentProps) => (
    <pre
      className="overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-5 text-[13px] leading-relaxed dark:bg-muted/30"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }: MdxComponentProps) => {
    const cls = className as string | undefined;
    const isBlock = cls?.startsWith("language-") || cls?.startsWith("hljs");
    if (isBlock) {
      return (
        <code className={cls} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[0.9em] font-mono text-foreground"
        {...props}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }: MdxComponentProps) => (
    <blockquote
      className="border-l-[3px] border-primary/40 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props: MdxComponentProps) => (
    <hr className="my-8 border-0 border-t border-border/40" {...props} />
  ),
  table: ({ children, ...props }: MdxComponentProps) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({ children, ...props }: MdxComponentProps) => (
    <th
      className="bg-muted/40 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: MdxComponentProps) => (
    <td className="border-t border-border/30 px-4 py-2.5" {...props}>
      {children}
    </td>
  ),
};

/* ------------------------------------------------------------------ */
/*  Build per-compilation component map with placeholders              */
/* ------------------------------------------------------------------ */

const COMPONENT_TAG_RE = /<([A-Z]\w*)/g;

function buildComponentMap(
  source: string,
): Record<string, React.ComponentType<MdxComponentProps>> {
  const map: Record<string, React.ComponentType<MdxComponentProps>> = {
    ...baseComponents,
  };
  for (const match of source.matchAll(COMPONENT_TAG_RE)) {
    const name = match[1] as string;
    if (!(name in map)) {
      map[name] = getPlaceholder(name);
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/*  Compile + run MDX with React in scope                              */
/* ------------------------------------------------------------------ */

/**
 * Trust boundary: this preview compiles arbitrary MDX with `new AsyncFunction`,
 * which has no closure access but can still call browser globals (fetch,
 * window, document.cookie). Treat any MDX that wasn't authored by the signed-
 * in user as untrusted — in particular, content pulled from external GitHub
 * repos via the import flow.
 *
 * For now we rely on the import flow only ingesting files from repos the user
 * has explicitly connected. If we ever broaden import sources (public repo
 * scraping, paste-from-URL, etc.) this preview must move into a sandboxed
 * iframe with a restrictive CSP before that lands.
 */
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  body: string,
) => (...args: unknown[]) => Promise<unknown>;

async function compileMdx(
  source: string,
  components: Record<string, React.ComponentType<MdxComponentProps>>,
): Promise<MdxModule> {
  const stripped = stripReactImports(source);

  const compiled = String(
    await compile(stripped, {
      outputFormat: "function-body",
      providerImportSource: "#",
      remarkPlugins: [remarkGfm],
      rehypePlugins: [rehypeHighlight],
    }),
  );

  const fn = new AsyncFunction(`${SCOPE_PREAMBLE}\n${compiled}`);

  return (await fn({
    ...runtime,
    useMDXComponents: () => components,
    __scope: REACT_SCOPE,
  })) as MdxModule;
}

/* ------------------------------------------------------------------ */
/*  Error boundary                                                     */
/* ------------------------------------------------------------------ */

type ErrorBoundaryProps = { children: ReactNode; fallback: ReactNode };
type ErrorBoundaryState = { error: Error | null };

class MdxErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("MDX render error:", error, info);
  }

  override render() {
    if (this.state.error) return this.props.fallback;
    return this.props.children;
  }
}

function CompileError({ message }: { message: string }) {
  return (
    <div className="mx-8 my-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <p className="mb-2 text-sm font-medium text-destructive">
        MDX Compilation Error
      </p>
      <pre className="whitespace-pre-wrap font-mono text-xs text-destructive/80">
        {message}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preview component                                                  */
/* ------------------------------------------------------------------ */

export function MdxPreview() {
  const content = useEditorStore((state) => state.content);
  const [compiled, setCompiled] = useState<MdxModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (!content) {
      setCompiled(null);
      setError(null);
      return;
    }

    let stale = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const components = buildComponentMap(content);
        const mod = await compileMdx(content, components);
        if (!stale) {
          setCompiled(mod);
          setError(null);
        }
      } catch (err) {
        if (!stale) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      stale = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content]);

  if (!content) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex h-full items-center justify-center p-8"
      >
        <div className="text-center">
          <p className="text-sm text-muted-foreground/60">
            Nothing to preview yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Start writing in the editor to see a live preview
          </p>
        </div>
      </motion.div>
    );
  }

  if (error) return <CompileError message={error} />;

  if (!compiled) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-sm text-muted-foreground/40">Compiling MDX…</p>
      </div>
    );
  }

  const Content = compiled.default;

  return (
    <MdxErrorBoundary
      fallback={<CompileError message="Failed to render MDX content." />}
    >
      <article className="prose prose-neutral dark:prose-invert max-w-none px-8 py-6 prose-headings:font-heading prose-headings:tracking-tight prose-headings:font-semibold prose-h1:text-[1.75rem] prose-h1:leading-tight prose-h2:text-[1.35rem] prose-h3:text-[1.15rem] prose-p:leading-[1.8] prose-p:text-foreground/90 prose-li:leading-[1.8] prose-pre:bg-transparent prose-pre:p-0 prose-pre:border-0 prose-img:rounded-xl prose-strong:text-foreground prose-strong:font-semibold">
        <Content />
      </article>
    </MdxErrorBoundary>
  );
}
