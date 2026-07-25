/**
 * Minimal Umami client — cloud (`api.umami.is/v1`, `x-umami-api-key`) and
 * self-hosted (`{baseUrl}/api`, `Authorization: Bearer`). A `baseUrl` on
 * the target means self-hosted. Timestamps are MILLISECOND epochs — the
 * classic Umami integration bug, kept inside this module.
 */

import type { PageStat, SnapshotTotals } from "./_lib/providers";

const UMAMI_CLOUD = "https://api.umami.is/v1";
const TIMEOUT_MS = 10_000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type UmamiResult<T> = { ok: true; data: T } | { ok: false; message: string };

function apiBase(baseUrl: string | undefined): string {
  if (!baseUrl) return UMAMI_CLOUD;
  return `${baseUrl.replace(/\/+$/, "")}/api`;
}

function authHeaders(
  token: string,
  baseUrl: string | undefined,
): Record<string, string> {
  return baseUrl
    ? { Authorization: `Bearer ${token}` }
    : { "x-umami-api-key": token };
}

async function umamiGet<T>(opts: {
  token: string;
  baseUrl: string | undefined;
  path: string;
}): Promise<UmamiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${apiBase(opts.baseUrl)}${opts.path}`, {
      headers: authHeaders(opts.token, opts.baseUrl),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      message: `Could not reach Umami: ${err instanceof Error ? err.message : "request failed"}`,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      message:
        res.status === 401
          ? "Umami rejected the token. Self-hosted bearer tokens expire — reconnect with a fresh one."
          : `Umami returned ${res.status}.`,
    };
  }
  try {
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, message: "Umami returned an unparseable response." };
  }
}

/**
 * Validate the token and resolve the websiteId by matching the site's
 * hostname — resolved once at connect time and stored on the target row.
 */
export async function resolveUmamiWebsite(opts: {
  token: string;
  baseUrl: string | undefined;
  hostname: string;
}): Promise<UmamiResult<{ websiteId: string }>> {
  const result = await umamiGet<{
    data: { id: string; domain: string }[];
  }>({
    token: opts.token,
    baseUrl: opts.baseUrl,
    path: "/websites?pageSize=200",
  });
  if (!result.ok) return result;
  const site = result.data.data?.find((w) => w.domain === opts.hostname);
  if (!site) {
    return {
      ok: false,
      message: `Token works, but no Umami website matches "${opts.hostname}". Check the domain configured in Umami.`,
    };
  }
  return { ok: true, data: { websiteId: site.id } };
}

/** Site totals + per-URL breakdown for the last 30 days — two calls total. */
export async function fetchUmamiStats(opts: {
  token: string;
  baseUrl: string | undefined;
  websiteId: string;
}): Promise<UmamiResult<{ totals: SnapshotTotals; pages: PageStat[] }>> {
  const endAt = Date.now();
  const startAt = endAt - THIRTY_DAYS_MS;
  const range = `startAt=${startAt}&endAt=${endAt}`;

  const stats = await umamiGet<{
    pageviews: { value: number };
    visitors: { value: number };
  }>({
    token: opts.token,
    baseUrl: opts.baseUrl,
    path: `/websites/${opts.websiteId}/stats?${range}`,
  });
  if (!stats.ok) return stats;

  const metrics = await umamiGet<{ x: string; y: number }[]>({
    token: opts.token,
    baseUrl: opts.baseUrl,
    path: `/websites/${opts.websiteId}/metrics?${range}&type=url&limit=500`,
  });
  if (!metrics.ok) return metrics;

  return {
    ok: true,
    data: {
      totals: {
        pageviews: stats.data.pageviews?.value ?? 0,
        visitors: stats.data.visitors?.value ?? 0,
      },
      pages: metrics.data.map((row) => ({
        path: row.x,
        pageviews: row.y,
      })),
    },
  };
}
