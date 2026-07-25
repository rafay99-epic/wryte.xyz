/**
 * Minimal Hashnode GraphQL client.
 *
 * ⚠ BETA — since 2026-05-13 Hashnode's entire GraphQL API requires the
 * publication Pro plan. Non-Pro requests to gql.hashnode.com come back as a
 * 301 redirect to an HTML announcement page, NOT a GraphQL error — we
 * detect that explicitly (redirect: "manual" + content-type check) and map
 * it to `needs_pro` so the UI can distinguish "bad token" from "token fine,
 * publication not on Pro". The publish/update happy path is built against
 * Hashnode's published schema but has not been executed live (no Pro
 * account available) — errors are captured verbatim for that reason.
 *
 * Auth header is the raw PAT — no "Bearer" prefix (Hashnode convention).
 */
"use node";

import type { SyndicationResult } from "./errors";

const HASHNODE_API = "https://gql.hashnode.com";
const TIMEOUT_MS = 10_000;

export type HashnodePost = { id: string; url: string; slug: string };
export type HashnodePublication = { id: string; url: string };

async function hashnodeGraphQL<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<SyndicationResult<T>> {
  let res: Response;
  try {
    res = await fetch(HASHNODE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Never follow the paywall redirect — a follower would land on an
      // HTML page and the JSON parse below would produce a misleading error.
      redirect: "manual",
    });
  } catch (err) {
    return {
      ok: false,
      code: "network",
      message: `Could not reach Hashnode: ${err instanceof Error ? err.message : "request failed"}`,
    };
  }

  if (res.status >= 300 && res.status < 400) {
    return {
      ok: false,
      code: "needs_pro",
      message:
        "Hashnode's API requires the publication Pro plan (since May 2026). The token may be fine — upgrade the publication at hashnode.com to enable cross-posting.",
    };
  }
  if (res.status >= 500) {
    return {
      ok: false,
      code: "network",
      message: `Hashnode returned ${res.status}.`,
    };
  }
  if (!res.headers.get("content-type")?.includes("json")) {
    return {
      ok: false,
      code: "needs_pro",
      message:
        "Hashnode returned a non-API response — this usually means the publication is not on the Pro plan required for API access.",
    };
  }

  let body: {
    data?: T;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return {
      ok: false,
      code: "internal",
      message: "Hashnode returned an unparseable response.",
    };
  }

  // GraphQL convention: HTTP 200 even on errors — check the errors array.
  const first = body.errors?.[0];
  if (first) {
    const code = first.extensions?.code;
    const message = `Hashnode: ${first.message}`;
    if (code === "UNAUTHENTICATED")
      return { ok: false, code: "invalid_token", message };
    if (code === "NOT_FOUND")
      return { ok: false, code: "remote_deleted", message };
    return { ok: false, code: "validation", message };
  }
  if (!body.data) {
    return {
      ok: false,
      code: "internal",
      message: "Hashnode returned an empty response.",
    };
  }
  return { ok: true, data: body.data };
}

/**
 * Token probe + publication list for the settings picker. Doubles as the
 * "needs Pro vs bad token" discriminator.
 */
export async function fetchHashnodePublications(
  token: string,
): Promise<
  SyndicationResult<{ username: string; publications: HashnodePublication[] }>
> {
  const result = await hashnodeGraphQL<{
    me: {
      username: string;
      publications: { edges: { node: { id: string; url: string } }[] };
    };
  }>(
    token,
    `query Me {
      me {
        username
        publications(first: 10) {
          edges { node { id url } }
        }
      }
    }`,
  );
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      username: result.data.me.username,
      publications: result.data.me.publications.edges.map((e) => e.node),
    },
  };
}

type PublishInput = {
  publicationId: string;
  title: string;
  contentMarkdown: string;
  slug: string;
  originalArticleURL: string;
  tags: { name: string; slug: string }[];
  subtitle?: string;
  coverImageURL?: string;
};

export async function publishHashnodePost(
  token: string,
  input: PublishInput,
): Promise<SyndicationResult<HashnodePost>> {
  const result = await hashnodeGraphQL<{
    publishPost: { post: HashnodePost | null } | null;
  }>(
    token,
    `mutation PublishPost($input: PublishPostInput!) {
      publishPost(input: $input) { post { id url slug } }
    }`,
    {
      input: {
        publicationId: input.publicationId,
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        slug: input.slug,
        originalArticleURL: input.originalArticleURL,
        tags: input.tags,
        ...(input.subtitle ? { subtitle: input.subtitle } : {}),
        ...(input.coverImageURL
          ? { coverImageOptions: { coverImageURL: input.coverImageURL } }
          : {}),
      },
    },
  );
  if (!result.ok) return result;
  const post = result.data.publishPost?.post;
  if (!post) {
    return {
      ok: false,
      code: "internal",
      message: "Hashnode did not return the created post.",
    };
  }
  return { ok: true, data: post };
}

export async function updateHashnodePost(
  token: string,
  postId: string,
  input: Omit<PublishInput, "publicationId" | "slug">,
): Promise<SyndicationResult<HashnodePost>> {
  const result = await hashnodeGraphQL<{
    updatePost: { post: HashnodePost | null } | null;
  }>(
    token,
    `mutation UpdatePost($input: UpdatePostInput!) {
      updatePost(input: $input) { post { id url slug } }
    }`,
    {
      input: {
        id: postId,
        title: input.title,
        contentMarkdown: input.contentMarkdown,
        originalArticleURL: input.originalArticleURL,
        // NB: updatePost replaces the entire tag set — always send the full list.
        tags: input.tags,
        ...(input.subtitle ? { subtitle: input.subtitle } : {}),
        ...(input.coverImageURL
          ? { coverImageOptions: { coverImageURL: input.coverImageURL } }
          : {}),
      },
    },
  );
  if (!result.ok) return result;
  const post = result.data.updatePost?.post;
  if (!post) {
    return {
      ok: false,
      code: "internal",
      message: "Hashnode did not return the updated post.",
    };
  }
  return { ok: true, data: post };
}

/** Dedup probe for the retry-after-timeout case (mirror of devto's canonical match). */
export async function findHashnodePostBySlug(
  token: string,
  publicationId: string,
  slug: string,
): Promise<SyndicationResult<HashnodePost | null>> {
  const result = await hashnodeGraphQL<{
    publication: { post: HashnodePost | null } | null;
  }>(
    token,
    `query FindPost($publicationId: ObjectId!, $slug: String!) {
      publication(id: $publicationId) { post(slug: $slug) { id url slug } }
    }`,
    { publicationId, slug },
  );
  if (!result.ok) return result;
  return { ok: true, data: result.data.publication?.post ?? null };
}
