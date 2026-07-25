/**
 * Minimal Plausible Stats API v2 client (cloud + self-hosted CE — same
 * path on either host). `fetch` only, so this runs in the default Convex
 * runtime. Rate limit is 600 req/hour per key; the snapshot TTL in
 * `snapshots.ts` keeps usage to a handful per hour.
 */

import type { PageStat, SnapshotTotals } from "./_lib/providers";

const PLAUSIBLE_CLOUD = "https://plausible.io";
const TIMEOUT_MS = 10_000;

type PlausibleResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

async function plausibleQuery<T>(opts: {
  token: string;
  baseUrl: string | undefined;
  body: unknown;
}): Promise<PlausibleResult<T>> {
  const base = (opts.baseUrl ?? PLAUSIBLE_CLOUD).replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/v2/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(opts.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      message: `Could not reach Plausible: ${err instanceof Error ? err.message : "request failed"}`,
    };
  }
  if (!res.ok) {
    let message = `Plausible returned ${res.status}.`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = `Plausible: ${body.error}`;
    } catch {
      // Keep status-only message.
    }
    return { ok: false, message };
  }
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return {
      ok: false,
      message: "Plausible returned an unparseable response.",
    };
  }
}

type QueryResponse = {
  results: { dimensions: string[]; metrics: number[] }[];
};

/** Cheapest possible probe — validates token + site access in one call. */
export async function validatePlausible(opts: {
  token: string;
  baseUrl: string | undefined;
  siteId: string;
}): Promise<PlausibleResult<null>> {
  const result = await plausibleQuery<QueryResponse>({
    token: opts.token,
    baseUrl: opts.baseUrl,
    body: {
      site_id: opts.siteId,
      metrics: ["visitors"],
      date_range: "day",
    },
  });
  return result.ok ? { ok: true, data: null } : result;
}

/**
 * Site totals + per-page breakdown for the last 30 days — two calls total,
 * regardless of post count (never per-post loops).
 */
export async function fetchPlausibleStats(opts: {
  token: string;
  baseUrl: string | undefined;
  siteId: string;
}): Promise<PlausibleResult<{ totals: SnapshotTotals; pages: PageStat[] }>> {
  const shared = { token: opts.token, baseUrl: opts.baseUrl };

  const totals = await plausibleQuery<QueryResponse>({
    ...shared,
    body: {
      site_id: opts.siteId,
      metrics: ["pageviews", "visitors"],
      date_range: "30d",
    },
  });
  if (!totals.ok) return totals;

  const breakdown = await plausibleQuery<QueryResponse>({
    ...shared,
    body: {
      site_id: opts.siteId,
      metrics: ["pageviews", "visitors"],
      date_range: "30d",
      dimensions: ["event:page"],
      order_by: [["pageviews", "desc"]],
      pagination: { limit: 500 },
    },
  });
  if (!breakdown.ok) return breakdown;

  const totalRow = totals.data.results[0]?.metrics ?? [0, 0];
  return {
    ok: true,
    data: {
      totals: { pageviews: totalRow[0] ?? 0, visitors: totalRow[1] ?? 0 },
      pages: breakdown.data.results.map((r) => ({
        path: r.dimensions[0] ?? "",
        pageviews: r.metrics[0] ?? 0,
        visitors: r.metrics[1] ?? 0,
      })),
    },
  };
}
