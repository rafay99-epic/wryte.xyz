/**
 * AI provider registry — the single source of truth.
 *
 * Every place that used to hard-code the `"anthropic" | "openai" | "openrouter"`
 * union or a per-provider model list now reads from here:
 *   - Convex arg/schema validators import {@link providerValidator}
 *   - Backend streaming + verification import {@link getProvider} and branch on
 *     {@link ProviderEntry.kind} (anthropic-native vs openai-compatible)
 *   - The settings UI maps {@link ALL_PROVIDERS} and reads each entry's models,
 *     key-prefix hint, and dashboard URL
 *
 * This file is import-safe from the browser: it pulls in only `convex/values`
 * (isomorphic) — never `@anthropic-ai/sdk`, `openai`, or any `"use node"`
 * module. The SDKs are imported lazily inside the Node action files
 * (`enhanceActions.ts`, `credentials.ts`).
 *
 * **Adding a provider is a one-file change:** add an id to {@link PROVIDER_IDS},
 * an entry to {@link PROVIDERS}, and a matching `v.literal(...)` to
 * {@link providerValidator}. The compile-time assertion below fails the type
 * check if those drift apart. OpenAI-compatible providers (Groq, DeepSeek,
 * Together, Ollama, …) need no new backend code — just `kind:
 * "openai-compatible"` plus a `baseURL`.
 */

import { v } from "convex/values";

/**
 * How the backend talks to a provider.
 * - `anthropic-native`: the Anthropic SDK (`messages.stream`, `models.list`)
 * - `openai-compatible`: the OpenAI SDK pointed at the provider's `baseURL`
 *   (the chat-completions + models-list shape). OpenAI itself uses the default
 *   base URL; OpenRouter et al. set a custom one.
 */
export type ProviderKind = "anthropic-native" | "openai-compatible";

export type ProviderModel = {
  /** Model id sent to the provider, e.g. "claude-sonnet-4-6". */
  value: string;
  /** Human label for the settings dropdown. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
};

export type ProviderEntry = {
  id: AiProvider;
  /** Display name used in the UI and in provider error prefixes. */
  label: string;
  kind: ProviderKind;
  /** OpenAI-compatible only; omit for the OpenAI default and for anthropic-native. */
  baseURL?: string;
  /** Extra HTTP headers (e.g. OpenRouter attribution). */
  extraHeaders?: Record<string, string>;
  /** Placeholder shown in the key input, e.g. "sk-ant-...". */
  keyPrefixHint: string;
  /** "Get your key →" link target. */
  dashboardUrl: string;
  /** Pre-selected model when the user first picks this provider. */
  defaultModel: string;
  models: ProviderModel[];
};

/**
 * The set of provider ids. Adding one here (plus a {@link PROVIDERS} entry and a
 * `v.literal` in {@link providerValidator}) is the entire surface for a new
 * provider.
 */
export const PROVIDER_IDS = ["anthropic", "openai", "openrouter"] as const;

export type AiProvider = (typeof PROVIDER_IDS)[number];

const OPENROUTER_HEADERS = {
  "HTTP-Referer": "https://wryte.xyz",
  "X-Title": "Wryte",
} as const;

export const PROVIDERS: Record<AiProvider, ProviderEntry> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    kind: "anthropic-native",
    keyPrefixHint: "sk-ant-...",
    dashboardUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-4-6",
    models: [
      {
        value: "claude-opus-4-8",
        label: "Claude Opus 4.8",
        description: "Most capable — best for complex rewrites",
      },
      {
        value: "claude-sonnet-4-6",
        label: "Claude Sonnet 4.6",
        description: "Best balance of intelligence and speed",
      },
      {
        value: "claude-haiku-4-5",
        label: "Claude Haiku 4.5",
        description: "Fastest, most cost-effective",
      },
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    // No baseURL → the OpenAI SDK's default endpoint.
    keyPrefixHint: "sk-...",
    dashboardUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4.1-mini",
    models: [
      {
        value: "gpt-4.1",
        label: "GPT-4.1",
        description: "Most capable GPT model",
      },
      {
        value: "gpt-4.1-mini",
        label: "GPT-4.1 Mini",
        description: "Fast and affordable",
      },
      {
        value: "gpt-4.1-nano",
        label: "GPT-4.1 Nano",
        description: "Fastest, lowest cost",
      },
    ],
  },
  openrouter: {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai-compatible",
    baseURL: "https://openrouter.ai/api/v1",
    extraHeaders: OPENROUTER_HEADERS,
    keyPrefixHint: "sk-or-...",
    dashboardUrl: "https://openrouter.ai/keys",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    models: [
      {
        value: "meta-llama/llama-3.3-70b-instruct:free",
        label: "Llama 3.3 70B",
        description: "Meta's capable open model (free)",
      },
      {
        value: "google/gemma-3-27b-it:free",
        label: "Gemma 3 27B",
        description: "Google's efficient open model (free)",
      },
      {
        value: "deepseek/deepseek-r1:free",
        label: "DeepSeek R1",
        description: "Reasoning-focused open model (free)",
      },
      {
        value: "openai/gpt-oss-120b:free",
        label: "GPT-OSS 120B",
        description: "OpenAI's open-weight model (free)",
      },
    ],
  },
};

/**
 * Convex validator for the provider union. Hand-maintained alongside
 * {@link PROVIDER_IDS} — the compile-time assertion below fails the type check
 * if the two ever diverge, so "forgot to add the literal" is a build error, not
 * a runtime surprise. Used by `schema.ts`, the credential actions/db, and the
 * enhancement actions so bad provider strings are rejected at the Convex
 * boundary.
 */
export const providerValidator = v.union(
  v.literal("anthropic"),
  v.literal("openai"),
  v.literal("openrouter"),
);

/**
 * Compile-time guard: `providerValidator.type` (the validator's inferred union)
 * and {@link AiProvider} (derived from {@link PROVIDER_IDS}) must be mutually
 * assignable. If a provider is added to one but not the other, this line stops
 * compiling. Type-only — no runtime cost.
 */
type AssertExtends<T extends true> = T;
export type _ProvidersInSync = AssertExtends<
  [AiProvider] extends [typeof providerValidator.type]
    ? [typeof providerValidator.type] extends [AiProvider]
      ? true
      : false
    : false
>;

/** All provider entries in declaration order — for mapping in the settings UI. */
export const ALL_PROVIDERS: ProviderEntry[] = PROVIDER_IDS.map(
  (id) => PROVIDERS[id],
);

export function getProvider(id: AiProvider): ProviderEntry {
  return PROVIDERS[id];
}

export function isProviderId(value: string): value is AiProvider {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}
