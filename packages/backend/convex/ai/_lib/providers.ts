import { v } from "convex/values";

export type ProviderKind =
  | "anthropic-native"
  | "openai-compatible"
  | "gemini-native";

export type ProviderModel = {
  value: string;
  label: string;
  description: string;
};

export type ProviderEntry = {
  id: AiProvider;
  label: string;
  kind: ProviderKind;
  baseURL?: string;
  extraHeaders?: Record<string, string>;
  keyPrefixHint: string;
  dashboardUrl: string;
  defaultModel: string;
  models: ProviderModel[];
};

export const PROVIDER_IDS = [
  "anthropic",
  "openai",
  "openrouter",
  "google",
  "groq",
] as const;

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
  google: {
    id: "google",
    label: "Google Gemini",
    kind: "gemini-native",
    keyPrefixHint: "AIza...",
    dashboardUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-3.5-flash",
    models: [
      {
        value: "gemini-3.5-flash",
        label: "Gemini 3.5 Flash",
        description: "Newest Flash — best for content writing",
      },
      {
        value: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        description: "Fast, high-volume, lower cost",
      },
    ],
  },
  groq: {
    id: "groq",
    label: "Groq",
    kind: "openai-compatible",
    baseURL: "https://api.groq.com/openai/v1",
    keyPrefixHint: "gsk_...",
    dashboardUrl: "https://console.groq.com/keys",
    defaultModel: "llama-3.3-70b-versatile",
    models: [
      {
        value: "llama-3.3-70b-versatile",
        label: "Llama 3.3 70B",
        description: "Best for content writing — fast on Groq",
      },
      {
        value: "openai/gpt-oss-120b",
        label: "GPT-OSS 120B",
        description: "Most capable open model",
      },
      {
        value: "openai/gpt-oss-20b",
        label: "GPT-OSS 20B",
        description: "Fastest, lightweight",
      },
    ],
  },
};

export const providerValidator = v.union(
  v.literal("anthropic"),
  v.literal("openai"),
  v.literal("openrouter"),
  v.literal("google"),
  v.literal("groq"),
);

type AssertExtends<T extends true> = T;
export type _ProvidersInSync = AssertExtends<
  [AiProvider] extends [typeof providerValidator.type]
    ? [typeof providerValidator.type] extends [AiProvider]
      ? true
      : false
    : false
>;

export const ALL_PROVIDERS: ProviderEntry[] = PROVIDER_IDS.map(
  (id) => PROVIDERS[id],
);

export function getProvider(id: AiProvider): ProviderEntry {
  return PROVIDERS[id];
}

export function isProviderId(value: string): value is AiProvider {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}
