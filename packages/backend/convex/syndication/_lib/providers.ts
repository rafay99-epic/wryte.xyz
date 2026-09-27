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
  dashboardUrl: string;
  keyHint: string;
  requiresPro: boolean;
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

export type SyndicationPublicConfig = {
  enabled: boolean;
  username?: string;
  publicationId?: string;
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
