/**
 * Post-embed resolver. Given a social post URL, identifies the provider,
 * fetches its oEmbed data server-side (no CORS, no client secrets), and
 * returns portable raw HTML to drop into the markdown — mirroring the
 * `<video>` embed pattern. Runs in the default Convex runtime; `fetch` needs
 * no Node. Auth-gated and rate-limited like the link checker.
 */
import { v } from "convex/values";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";
import {
  type EmbedResult,
  matchProvider,
  type OembedProvider,
  parsePostUrl,
} from "./oembedProviders";

const TIMEOUT_MS = 6000;
const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;

type OembedResponse = {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  provider_name?: string;
  html?: string;
};

export const resolve = action({
  args: { url: v.string() },
  handler: async (ctx, args): Promise<EmbedResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "tools:oembed", { key, throws: true });

    const provider = matchProvider(args.url);
    if (!provider)
      throw new Error(
        "That URL isn't a supported post embed. Supported: Twitter/X, YouTube, Vimeo, Reddit, Bluesky, Spotify, Giphy, Mastodon.",
      );

    const postUrl = parsePostUrl(args.url);
    if (!postUrl) throw new Error("Invalid URL.");

    let oembed: OembedResponse = {};
    if (provider.oembed) {
      oembed = await fetchOembed(provider.oembed(postUrl));
    }

    const embedHtml = buildEmbedHtml(provider, postUrl, oembed);
    if (!embedHtml) throw new Error("Couldn't build an embed for that URL.");

    return {
      provider: provider.id,
      url: postUrl.href,
      title: oembed.title ?? null,
      authorName: oembed.author_name ?? null,
      authorUrl: oembed.author_url ?? null,
      thumbnailUrl: oembed.thumbnail_url ?? null,
      embedHtml,
    };
  },
});

async function fetchOembed(endpoint: string): Promise<OembedResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "user-agent": "wryte-oembed/1.0",
      },
    });
    if (!res.ok) throw new Error(`Provider responded with HTTP ${res.status}.`);
    return (await res.json()) as OembedResponse;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Provider took too long to respond.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function buildEmbedHtml(
  provider: OembedProvider,
  postUrl: URL,
  oembed: OembedResponse,
): string {
  if (provider.embedKind === "blockquote") {
    return stripScripts(oembed.html ?? "");
  }
  if (oembed.html) return oembed.html;
  if (provider.constructIframeSrc) {
    const src = provider.constructIframeSrc(postUrl);
    return `<iframe src="${src}" allowfullscreen loading="lazy"></iframe>`;
  }
  return "";
}

function stripScripts(html: string): string {
  return html.replace(SCRIPT_RE, "").trim();
}
