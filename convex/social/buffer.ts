/**
 * Minimal Buffer GraphQL API client.
 *
 * Buffer's API (https://developers.buffer.com) is a single GraphQL endpoint
 * authenticated with a Bearer key the user creates at
 * publish.buffer.com/settings/api. We use exactly three operations:
 * organizations (to scope the channels query), channels (verification +
 * the pickable platform list), and createPost (the announcement itself).
 */
"use node";

const BUFFER_API_URL = "https://api.buffer.com";
const TIMEOUT_MS = 15_000;

export type BufferChannel = {
  id: string;
  service: string;
  name: string;
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

async function bufferGraphQL<T>(
  apiKey: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    const res = await fetch(BUFFER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: "Buffer rejected the API key." };
    }
    if (!res.ok) {
      return { ok: false, message: `Buffer returned ${res.status}.` };
    }

    const body = (await res.json()) as GraphQLResponse<T>;
    if (body.errors?.length) {
      return {
        ok: false,
        message: `Buffer error: ${body.errors[0]?.message ?? "unknown"}`,
      };
    }
    if (!body.data) {
      return { ok: false, message: "Buffer returned an empty response." };
    }
    return { ok: true, data: body.data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "request failed";
    return { ok: false, message: `Could not reach Buffer: ${msg}` };
  }
}

/**
 * Verify a key and list the account's connected channels. Doubles as the
 * credential check: a key that can't list channels can't post.
 */
export async function fetchBufferChannels(
  apiKey: string,
): Promise<
  { ok: true; channels: BufferChannel[] } | { ok: false; message: string }
> {
  const orgs = await bufferGraphQL<{
    account: { organizations: { id: string }[] };
  }>(apiKey, "query { account { organizations { id } } }");
  if (!orgs.ok) return orgs;

  const orgIds = orgs.data.account?.organizations?.map((o) => o.id) ?? [];
  if (orgIds.length === 0) {
    return { ok: false, message: "No Buffer organization on this account." };
  }

  const channels: BufferChannel[] = [];
  for (const organizationId of orgIds) {
    const result = await bufferGraphQL<{ channels: BufferChannel[] }>(
      apiKey,
      `query GetChannels($organizationId: ID!) {
        channels(input: { organizationId: $organizationId }) {
          id
          name
          service
        }
      }`,
      { organizationId },
    );
    if (!result.ok) return result;
    channels.push(...(result.data.channels ?? []));
  }

  return { ok: true, channels };
}

/**
 * Post text to one channel immediately (shareNow — an announcement should
 * go out with the publish, not sit in a queue slot hours later).
 */
export async function createBufferPost(
  apiKey: string,
  channelId: string,
  text: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  type CreatePostResult = {
    createPost: { post?: { id: string }; message?: string } | null;
  };
  const result = await bufferGraphQL<CreatePostResult>(
    apiKey,
    `mutation CreatePost($channelId: ID!, $text: String!) {
      createPost(input: {
        channelId: $channelId,
        text: $text,
        schedulingType: automatic,
        mode: shareNow
      }) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }`,
    { channelId, text },
  );
  if (!result.ok) return result;
  const payload = result.data.createPost;
  if (payload && "post" in payload && payload.post?.id) return { ok: true };
  return {
    ok: false,
    message: payload?.message ?? "Buffer did not accept the post.",
  };
}
