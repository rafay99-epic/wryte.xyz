"use client";

import { Component, type ReactNode } from "react";

class AnimationErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { error: Error | null }
> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

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
