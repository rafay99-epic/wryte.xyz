import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";

/** Shim for `next/navigation` `usePathname`. */
export function usePathname(): string {
  const location = useLocation();
  return location.pathname;
}

/**
 * Shim for `next/navigation` `useRouter`. Supports the subset of the App
 * Router API the web sources use: push, replace, back, prefetch (noop).
 */
export function useRouter() {
  const navigate = useNavigate();

  return {
    push: useCallback((href: string) => navigate(href), [navigate]),
    replace: useCallback(
      (href: string) => navigate(href, { replace: true }),
      [navigate],
    ),
    back: useCallback(() => navigate(-1), [navigate]),
    forward: useCallback(() => navigate(1), [navigate]),
    refresh: useCallback(() => undefined, []),
    prefetch: useCallback(() => undefined, []),
  };
}

export function redirect(href: string): never {
  window.location.hash = href;
  throw new Error(`redirect: ${href}`);
}

/** Next's notFound() — renders nothing; route-level guards handle fallbacks. */
export function notFound(): never {
  throw new Error("notFound");
}
