"use client";

import { Component, type ReactNode } from "react";

/**
 * Per-animation error boundary. A user-authored component that throws during
 * render must degrade to an inline error card — never take down the whole
 * MDX preview (which has its own coarse boundary) or the author sheet.
 */
class AnimationErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  /** Re-arm after the source changes so a fix is reflected immediately. */
  override componentDidUpdate(prevProps: { children: ReactNode }) {
    if (this.state.error && prevProps.children !== this.props.children) {
      this.setState({ error: null });
    }
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="my-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <p className="font-mono text-xs text-destructive">
            &lt;{this.props.name} /&gt; crashed while rendering
          </p>
          <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-destructive/70">
            {this.state.error.message}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Wraps a compiled animation component so render-time crashes stay local.
 * Returns a drop-in component for the MDX component map / preview pane.
 */
export function wrapAnimation(
  name: string,
  Comp: React.ComponentType,
): React.ComponentType<Record<string, unknown>> {
  const Wrapped = (props: Record<string, unknown>) => (
    <AnimationErrorBoundary name={name}>
      <Comp {...props} />
    </AnimationErrorBoundary>
  );
  Wrapped.displayName = `Animation(${name})`;
  return Wrapped;
}
