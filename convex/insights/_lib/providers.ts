/**
 * Analytics provider registry — mirrors `syndication/_lib/providers.ts`.
 * Import-safe from the browser (only `convex/values`). GA4 is deliberately
 * absent: it has no paste-a-token auth path (OAuth2/service accounts only).
 * Fathom can slot in later as a third entry + client file.
 */

import { v } from "convex/values";

export const ANALYTICS_PROVIDER_IDS = ["plausible", "umami"] as const;

export type AnalyticsProvider = (typeof ANALYTICS_PROVIDER_IDS)[number];

export const analyticsProviderValidator = v.union(
  v.literal("plausible"),
  v.literal("umami"),
);

export type AnalyticsProviderEntry = {
  id: AnalyticsProvider;
  label: string;
  dashboardUrl: string;
  keyHint: string;
  /** Self-hosted instances need a base URL; cloud uses the default. */
  supportsSelfHosted: boolean;
};

export const ANALYTICS_PROVIDERS: Record<
  AnalyticsProvider,
  AnalyticsProviderEntry
> = {
  plausible: {
    id: "plausible",
    label: "Plausible",
    dashboardUrl: "https://plausible.io/settings/api-keys",
    keyHint: "Stats API key",
    supportsSelfHosted: true,
  },
  umami: {
    id: "umami",
    label: "Umami",
    dashboardUrl: "https://cloud.umami.is/settings/api-keys",
    keyHint: "API key (cloud) or bearer token (self-hosted)",
    supportsSelfHosted: true,
  },
};

export const ALL_ANALYTICS_PROVIDERS: AnalyticsProviderEntry[] =
  ANALYTICS_PROVIDER_IDS.map((id) => ANALYTICS_PROVIDERS[id]);

/** Per-page numbers stored in a snapshot's `pagesJson`. */
export type PageStat = {
  /** URL path as reported by the provider, e.g. "/blog/my-post". */
  path: string;
  pageviews: number;
  /** Plausible reports visitors per page; Umami's URL breakdown does not. */
  visitors?: number;
};

export type SnapshotTotals = { pageviews: number; visitors: number };
