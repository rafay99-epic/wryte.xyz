import AppError from "@/app/(app)/error";
import EditorError from "@/app/(app)/editor/error";
import AppNotFound from "@/app/(app)/not-found";
import { useRouteError } from "react-router";

/**
 * Bridges the web app's Next.js error boundaries onto react-router's
 * `errorElement`. The boundary components are imported straight from the web
 * source tree so the desktop error UI stays pixel-identical.
 *
 * Next's `reset` retries the render; a pure SPA's closest safe equivalent is
 * a full reload, which also clears any corrupted lazy-chunk state.
 */
export function AppErrorBoundary() {
  const error = useRouteError();
  return (
    <AppError
      error={error instanceof Error ? error : new Error(String(error))}
      reset={() => window.location.reload()}
    />
  );
}

export function EditorErrorBoundary() {
  const error = useRouteError();
  return (
    <EditorError
      error={error instanceof Error ? error : new Error(String(error))}
      reset={() => window.location.reload()}
    />
  );
}

export { AppNotFound };
