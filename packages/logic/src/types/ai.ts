import {
  type AiProvider,
  ALL_PROVIDERS,
  PROVIDER_IDS,
} from "@wryte/backend/ai/_lib/providers";

export type {
  AiProvider,
  ProviderEntry,
  ProviderModel,
} from "@wryte/backend/ai/_lib/providers";
export {
  ALL_PROVIDERS,
  getProvider,
  isProviderId,
  PROVIDER_IDS,
} from "@wryte/backend/ai/_lib/providers";

export const AI_PROVIDERS: readonly AiProvider[] = PROVIDER_IDS;

export type AiCredentialStatus =
  | "active"
  | "verifying"
  | "invalid"
  | "rotating";

export const AI_PROVIDER_LABELS: Record<AiProvider, string> =
  Object.fromEntries(ALL_PROVIDERS.map((p) => [p.id, p.label])) as Record<
    AiProvider,
    string
  >;

export const AI_MODEL_LABELS: Record<string, string> = Object.fromEntries(
  ALL_PROVIDERS.flatMap((p) => p.models.map((m) => [m.value, m.label])),
);
