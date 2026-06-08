/**
 * Shared AI provider types — re-exported from the single source of truth in
 * `convex/ai/_lib/providers.ts`.
 *
 * The Convex backend validators, the schema, and this file all derive from the
 * same registry, so adding a provider there flows through to the frontend with
 * no edits here. The `@/types/ai` import path stays stable for existing
 * consumers (`provider-logos.tsx`, `project-settings/types.ts`, …).
 */

import {
  type AiProvider,
  ALL_PROVIDERS,
  PROVIDER_IDS,
} from "../../convex/ai/_lib/providers";

export type {
  AiProvider,
  ProviderEntry,
  ProviderModel,
} from "../../convex/ai/_lib/providers";
export {
  ALL_PROVIDERS,
  getProvider,
  isProviderId,
  PROVIDER_IDS,
} from "../../convex/ai/_lib/providers";

export const AI_PROVIDERS: readonly AiProvider[] = PROVIDER_IDS;

export type AiCredentialStatus =
  | "active"
  | "verifying"
  | "invalid"
  | "rotating";

/** Display labels used in dropdowns, badges, and toasts. */
export const AI_PROVIDER_LABELS: Record<AiProvider, string> =
  Object.fromEntries(ALL_PROVIDERS.map((p) => [p.id, p.label])) as Record<
    AiProvider,
    string
  >;

/** Friendly model labels, keyed by model id, across every provider. */
export const AI_MODEL_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PROVIDERS.flatMap((p) => p.models.map((m) => [m.value, m.label])),
);
