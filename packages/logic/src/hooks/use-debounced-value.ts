"use client";

import { useEffect, useState } from "react";

/**
 * Trails `value` by `delayMs`, resetting the timer on every change.
 *
 * Used to keep a fast typist from opening one Convex subscription per
 * keystroke: gate a query on the debounced value, not the live one. Shared by
 * the command palette's body search and the project content search, which run
 * the same query against the same index.
 *
 * The trailing edge is the whole point — a leading-edge or throttled variant
 * would fire on the first character, which is the query this exists to avoid.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
