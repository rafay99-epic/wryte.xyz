/**
 * Syndication provider registry — the single source of truth.
 *
 * Mirrors `convex/ai/_lib/providers.ts`: Convex validators import
 * {@link syndicationProviderValidator}, the settings UI maps
 * {@link ALL_SYNDICATION_PROVIDERS}, and the post/credentials actions
 * branch on the id. Import-safe from the browser — only `convex/values`.
 *
 * Adding a platform is a one-file change here plus a client module next to
 * `devto.ts` / `hashnode.ts`. (Medium is deliberately absent: its write API
 * was discontinued; only a lossy import-by-URL tool remains.)
 */

import { v } from "convex/values";

export const SYNDICATION_PROVIDER_IDS = ["devto", "hashnode"] as const;

export type SyndicationProvider = (typeof SYNDICATION_PROVIDER_IDS)[number];

export const syndicationProviderValidator = v.union(
  v.literal("devto"),
  v.literal("hashnode"),
);

export type SyndicationProviderEntry = {
  id: SyndicationProvider;
  label: string;
  /** "Get your key →" link target. */
  dashboardUrl: string;
  /** Placeholder shown in the token input. */
  keyHint: string;
  /** Requires a paid plan on the platform's side. */
  requiresPro: boolean;
  /** Shipped without a live happy-path test — surfaced as a Beta badge. */
  beta: boolean;
};

export const SYNDICATION_PROVIDERS: Record<
  SyndicationProvider,
  SyndicationProviderEntry
> = {
  devto: {
    id: "devto",
    label: "dev.to",
    dashboardUrl: "https://dev.to/settings/extensions",
    keyHint: "DEV Community API key",
    requiresPro: false,
    beta: false,
  },
  hashnode: {
    id: "hashnode",
    label: "Hashnode",
    dashboardUrl: "https://hashnode.com/settings/developer",
    keyHint: "Personal Access Token",
    requiresPro: true,
    beta: true,
  },
};

export const ALL_SYNDICATION_PROVIDERS: SyndicationProviderEntry[] =
  SYNDICATION_PROVIDER_IDS.map((id) => SYNDICATION_PROVIDERS[id]);

/**
 * Non-secret per-provider settings cached in `publicConfig` (JSON string on
 * the credential row). `enabled` defaults to false — connecting a token
 * never activates posting by itself.
 */
export type SyndicationPublicConfig = {
  enabled: boolean;
  /** dev.to: username from the verify call. */
  username?: string;
  /** Hashnode: publication chosen as the cross-post target. */
  publicationId?: string;
  /** Hashnode: all publications on the account, for the settings picker. */
  publications?: { id: string; url: string }[];
};

export function parseSyndicationConfig(
  raw: string | undefined,
): SyndicationPublicConfig {
  if (!raw) return { enabled: false };
  try {
    const parsed = JSON.parse(raw) as Partial<SyndicationPublicConfig>;
    return {
      enabled: parsed.enabled === true,
      ...(typeof parsed.username === "string"
        ? { username: parsed.username }
        : {}),
      ...(typeof parsed.publicationId === "string"
        ? { publicationId: parsed.publicationId }
        : {}),
      ...(Array.isArray(parsed.publications)
        ? { publications: parsed.publications }
        : {}),
    };
  } catch {
    return { enabled: false };
  }
}
