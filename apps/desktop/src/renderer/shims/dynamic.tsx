import { type ComponentType, lazy, type ReactNode, Suspense } from "react";

type DynamicOptions = {
  ssr?: boolean;
  loading?: () => ReactNode;
};

/**
 * Shim for `next/dynamic` — React.lazy + Suspense. `ssr: false` is accepted
 * and ignored (the renderer is client-only). The optional `loading` option
 * renders while the chunk loads.
 */
export function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>,
  options?: DynamicOptions,
): ComponentType<P> {
  const Lazy = lazy(async () => {
    const mod = await loader();
    return "default" in mod && typeof mod.default === "function"
      ? (mod as { default: ComponentType<P> })
      : { default: mod as unknown as ComponentType<P> };
  });

  function DynamicWithLoading(props: P) {
    return (
      <Suspense fallback={options?.loading?.() ?? null}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return DynamicWithLoading as ComponentType<P>;
}

export default dynamic;
