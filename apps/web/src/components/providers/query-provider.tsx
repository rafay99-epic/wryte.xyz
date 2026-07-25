"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * TanStack Query provider for the application.
 *
 * Creates a single QueryClient instance per React tree (using useState to
 * avoid re-creating it on every render) and wraps the app with the provider.
 *
 * Global defaults:
 *  - `staleTime: 60s` — data is considered fresh for 1 minute by default.
 *    Individual hooks override this when a different cadence makes sense.
 *  - `gcTime: 5m` — unused cache entries are garbage-collected after 5 minutes.
 *  - `refetchOnWindowFocus: true` — data is revalidated when the user returns
 *    to the tab, keeping the UI fresh without manual refresh buttons.
 *  - `retry: 1` — failed queries retry once before surfacing the error.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
