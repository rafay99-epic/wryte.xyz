/**
 * Minimal dev.to (Forem API v1) client.
 *
 * REST with an `api-key` header. Operative limits (Forem source): published
 * article creation 9/30s (429 + Retry-After), tags alphanumeric max 4.
 * Every failure maps to the shared {@link SyndicationErrorCode} taxonomy.
 */
"use node";

import type { SyndicationFailure, SyndicationResult } from "./errors";

const DEVTO_API = "https://dev.to/api";
const TIMEOUT_MS = 10_000;

export type DevtoArticleInput = {
  title: string;
  body_markdown: string;
  published: boolean;
  canonical_url?: string;
  description?: string;
  main_image?: string;
  /** Comma-separated, already normalized (see transform.ts). */
  tags?: string;
};

export type DevtoArticle = {
  id: number;
  url: string;
  slug: string;
};

async function devtoFetch<T>(
  apiKey: string,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<SyndicationResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${DEVTO_API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/vnd.forem.api-v1+json",
      },
      ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return {
      ok: false,
      code: "network",
      message: `Could not reach dev.to: ${err instanceof Error ? err.message : "request failed"}`,
    };
  }

  if (res.ok) {
    try {
      return { ok: true, data: (await res.json()) as T };
    } catch {
      return {
        ok: false,
        code: "internal",
        message: "dev.to returned an unparseable response.",
      };
    }
  }

  let message = `dev.to returned ${res.status}.`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = `dev.to: ${body.error}`;
  } catch {
    // Keep the status-only message.
  }

  const failure: SyndicationFailure = (() => {
    if (res.status === 401 || res.status === 403)
      return { ok: false as const, code: "invalid_token" as const, message };
    if (res.status === 404)
      return { ok: false as const, code: "remote_deleted" as const, message };
    if (res.status === 422)
      return { ok: false as const, code: "validation" as const, message };
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("Retry-After"));
      return {
        ok: false as const,
        code: "rate_limited" as const,
        message,
        retryAfterMs:
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : 30_000,
      };
    }
    if (res.status >= 500)
      return { ok: false as const, code: "network" as const, message };
    return { ok: false as const, code: "internal" as const, message };
  })();
  return failure;
}

/** Cheap token probe; the username lands in publicConfig for the UI. */
export async function verifyDevtoKey(
  apiKey: string,
): Promise<SyndicationResult<{ username: string }>> {
  const result = await devtoFetch<{ username?: string }>(apiKey, "/users/me");
  if (!result.ok) return result;
  return { ok: true, data: { username: result.data.username ?? "" } };
}

export async function createDevtoArticle(
  apiKey: string,
  article: DevtoArticleInput,
): Promise<SyndicationResult<DevtoArticle>> {
  return devtoFetch<DevtoArticle>(apiKey, "/articles", {
    method: "POST",
    body: { article },
  });
}

export async function updateDevtoArticle(
  apiKey: string,
  articleId: number,
  article: DevtoArticleInput,
): Promise<SyndicationResult<DevtoArticle>> {
  return devtoFetch<DevtoArticle>(apiKey, `/articles/${articleId}`, {
    method: "PUT",
    body: { article },
  });
}

/**
 * Dedup fallback for the retry-after-timeout case: a create may have
 * succeeded remotely even though we never saw the response. Matching our
 * canonical URL against the account's own articles adopts the existing
 * post instead of duplicating it.
 */
export async function findDevtoArticleByCanonical(
  apiKey: string,
  canonicalUrl: string,
): Promise<SyndicationResult<DevtoArticle | null>> {
  const result = await devtoFetch<
    { id: number; url: string; slug: string; canonical_url?: string }[]
  >(apiKey, "/articles/me/all?per_page=100");
  if (!result.ok) return result;
  const match = result.data.find((a) => a.canonical_url === canonicalUrl);
  return { ok: true, data: match ?? null };
}
