"use client";

import { compile } from "@mdx-js/mdx";
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
import { codeComponents } from "@/components/markdown/code-overrides";
import { embedComponents } from "@/components/markdown/embed-overrides";
import { VideoEmbed } from "@/components/markdown/video-embed";

export type MdxModule = { default: React.ComponentType };
export type MdxComponentProps = Record<string, unknown> & {
  children?: ReactNode;
};
export type MdxComponentMap = Record<string, React.ElementType>;

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

const baseComponents: MdxComponentMap = {
  ...embedComponents,
  ...codeComponents,
  video: (props: MdxComponentProps) => (
    <VideoEmbed {...(props as React.VideoHTMLAttributes<HTMLVideoElement>)} />
  ),
  img: ({ alt, src, ...props }: MdxComponentProps) => (
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

const COMPONENT_TAG_RE = /<([A-Z]\w*)/g;

export function buildComponentMap(
  source: string,
  userComponents: Record<string, React.ComponentType<MdxComponentProps>> = {},
): MdxComponentMap {
  const map: MdxComponentMap = {
    ...baseComponents,
    ...userComponents,
  };
  for (const match of source.matchAll(COMPONENT_TAG_RE)) {
    const name = match[1] as string;
    if (!(name in map)) {
      map[name] = getPlaceholder(name);
    }
  }
  return map;
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (
  body: string,
) => (...args: unknown[]) => Promise<unknown>;

export async function compileMdx(
  source: string,
  components: MdxComponentMap,
): Promise<MdxModule> {
  const stripped = stripReactImports(source);

  const compiled = String(
    await compile(stripped, {
      outputFormat: "function-body",
      providerImportSource: "#",
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypeHighlight, { plainText: ["mermaid"] }]],
    }),
  );

  const fn = new AsyncFunction(`${SCOPE_PREAMBLE}\n${compiled}`);

  return (await fn({
    ...runtime,
    useMDXComponents: () => components,
    __scope: REACT_SCOPE,
  })) as MdxModule;
}

type ErrorBoundaryProps = { children: ReactNode; fallback: ReactNode };
type ErrorBoundaryState = { error: Error | null };

export class MdxErrorBoundary extends Component<
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

export function CompileError({ message }: { message: string }) {
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
