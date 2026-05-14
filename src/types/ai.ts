/**
 * Shared AI provider types.
 *
 * The Convex backend in `convex/ai/*` accepts these provider names as
 * validator unions. Keeping the FE type in sync with the BE validator
 * means every place that touches AI credentials, model selection, or
 * status pulls from the same source of truth.
 */

export type AiProvider = "anthropic" | "openai" | "openrouter";

export const AI_PROVIDERS: readonly AiProvider[] = [
  "anthropic",
  "openai",
  "openrouter",
] as const;

export type AiCredentialStatus =
  | "active"
  | "verifying"
  | "invalid"
  | "rotating";

/** Display labels used in dropdowns, badges, and toasts. */
export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
};

/** Friendly model labels for the common default models. */
export const AI_MODEL_LABELS: Record<string, string> = {
  "claude-sonnet-4-5": "Claude Sonnet 4.5",
  "claude-opus-4": "Claude Opus 4",
  "claude-haiku-4-5": "Claude Haiku 4.5",
  "gpt-5": "GPT-5",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o mini",
};
