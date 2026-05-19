"use client";

import { evaluate } from "@mdx-js/mdx";
import { useMDXComponents } from "@mdx-js/react";
import { motion } from "framer-motion";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as runtime from "react/jsx-runtime";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useEditorStore } from "@/stores/editor-store";

type MdxModule = { default: React.ComponentType };

const DEBOUNCE_MS = 300;

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

const baseComponents: Record<
  string,
  React.ComponentType<Record<string, unknown>>
> = {
  img: ({ alt, src, ...props }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src as string}
      alt={(alt as string) ?? ""}
      className="my-6 max-w-full rounded-xl shadow-sm"
      loading="lazy"
      {...props}
    />
  ),
  a: ({
    children,
    href,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
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
  pre: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
    <pre
      className="overflow-x-auto rounded-xl border border-border/50 bg-muted/40 p-5 text-[13px] leading-relaxed dark:bg-muted/30"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({
    children,
    className,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => {
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
  blockquote: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
    <blockquote
      className="border-l-[3px] border-primary/40 pl-4 italic text-muted-foreground"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props: Record<string, unknown>) => (
    <hr className="my-8 border-0 border-t border-border/40" {...props} />
  ),
  table: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  th: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
    <th
      className="bg-muted/40 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({
    children,
    ...props
  }: Record<string, unknown> & { children?: ReactNode }) => (
    <td className="border-t border-border/30 px-4 py-2.5" {...props}>
      {children}
    </td>
  ),
};

const componentProxy = new Proxy(baseComponents, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    return ({ children }: { children?: ReactNode }) => (
      <UnknownComponent name={prop}>{children}</UnknownComponent>
    );
  },
});

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

export function MdxPreview() {
  const content = useEditorStore((state) => state.content);
  const providedComponents = useMDXComponents();
  const [compiled, setCompiled] = useState<MdxModule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const mergedComponents = useMemo(
    () => ({ ...componentProxy, ...providedComponents }),
    [providedComponents],
  );

  useEffect(() => {
    if (!content) {
      setCompiled(null);
      setError(null);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const mod = await evaluate(content, {
          ...runtime,
          remarkPlugins: [remarkGfm],
          rehypePlugins: [rehypeHighlight],
          useMDXComponents: () => mergedComponents,
        } as Parameters<typeof evaluate>[1]);
        setCompiled(mod as MdxModule);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [content, mergedComponents]);

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
