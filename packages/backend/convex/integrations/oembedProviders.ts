/**
 * Provider registry for post embeds (oEmbed + constructed iframes).
 *
 * Pure data + helpers — no Convex imports — so it can be imported from both
 * the Convex `oembed` action (backend) and the Next.js frontend (sanitize
 * schema, dialog hints). Keep it that way: adding a provider here is the
 * single change needed to enable it end-to-end.
 */

export type EmbedKind = "iframe" | "blockquote";
export type EmbedAspect = "video" | "bar" | "fluid";

/**
 * Provider-specific widget loader for blockquote embeds. Each provider's
 * loader exposes a readiness predicate (the global they set isn't always
 * the full API — TikTok sets a data object first, then `.lib` later) and a
 * render trigger that re-hydrates dynamically-inserted markup. The functions
 * touch `window` and are only ever called from the client (`social-embed`);
 * defining them here is safe because Convex never invokes them.
 */
export type EmbedLoader = {
  /** Widget loader script src (injected once, client-side). */
  src: string;
  /** Stable id for the injected <script> tag (dedupes across mounts). */
  scriptId: string;
  /** Returns true once the loader global is fully ready to render. */
  isReady: () => boolean;
  /** Render (or re-render) the embed inside the given element. */
  render: (el: HTMLElement) => void;
};

export type OembedProvider = {
  id: string;
  label: string;
  /** Matches the public post URL. */
  urlPattern: RegExp;
  embedKind: EmbedKind;
  /** Layout hint for the iframe renderer. */
  aspect: EmbedAspect;
  /** oEmbed endpoint builder, or null for construct-only providers. */
  oembed: ((postUrl: URL) => string) | null;
  /** For construct-only providers: build the embed iframe src. */
  constructIframeSrc: ((postUrl: URL) => string) | null;
  /** For iframe providers: matches the embed iframe src (without protocol). */
  iframeSrcPattern: RegExp | null;
  /** Blockquote providers: the class that identifies this provider's embed markup. */
  blockquoteClass: string | null;
  /** Blockquote providers: the widget loader that hydrates the markup. */
  loader: EmbedLoader | null;
};

/* ── Loader global typings (kept local; only the predicates read them) ── */

type TwitterGlobal = { widgets: { load: (el?: HTMLElement) => void } };
type TiktokGlobal = { lib: { render: (nodes: HTMLElement[]) => void } };

export const PROVIDERS: readonly OembedProvider[] = [
  {
    id: "youtube",
    label: "YouTube",
    urlPattern:
      /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i,
    embedKind: "iframe",
    aspect: "video",
    oembed: (u) =>
      `https://www.youtube.com/oembed?url=${encodeURIComponent(u.href)}&format=json`,
    constructIframeSrc: null,
    iframeSrcPattern: /^(?:www\.youtube\.com|youtube-nocookie\.com)\/embed\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "vimeo",
    label: "Vimeo",
    urlPattern: /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\//i,
    embedKind: "iframe",
    aspect: "video",
    oembed: (u) =>
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: /^player\.vimeo\.com\/video\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "twitter",
    label: "Twitter / X",
    urlPattern:
      /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:twitter|x)\.com\/[^/]+\/status\//i,
    embedKind: "blockquote",
    aspect: "fluid",
    oembed: (u) =>
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(u.href)}&omit_script=true`,
    constructIframeSrc: null,
    iframeSrcPattern: null,
    blockquoteClass: "twitter-tweet",
    loader: {
      src: "https://platform.twitter.com/widgets.js",
      scriptId: "twitter-widgets-loader",
      isReady: () => {
        const w = window as unknown as { twttr?: TwitterGlobal };
        return Boolean(w.twttr?.widgets);
      },
      render: (el) => {
        const w = window as unknown as { twttr?: TwitterGlobal };
        const widgets = w.twttr?.widgets;
        if (widgets) widgets.load(el);
      },
    },
  },
  {
    id: "tiktok",
    label: "TikTok",
    urlPattern: /^(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@[^/]+\/video\//i,
    embedKind: "blockquote",
    aspect: "fluid",
    oembed: (u) =>
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: null,
    blockquoteClass: "tiktok-embed",
    loader: {
      src: "https://www.tiktok.com/embed.js",
      scriptId: "tiktok-embed-loader",
      isReady: () => {
        const w = window as unknown as { tiktokEmbed?: TiktokGlobal };
        return Boolean(w.tiktokEmbed?.lib);
      },
      render: (el) => {
        const w = window as unknown as { tiktokEmbed?: TiktokGlobal };
        const lib = w.tiktokEmbed?.lib;
        if (lib) lib.render([el]);
      },
    },
  },
  {
    id: "reddit",
    label: "Reddit",
    urlPattern:
      /^(?:https?:\/\/)?(?:www\.|old\.|new\.)?reddit\.com\/r\/[^/]+\/comments\//i,
    embedKind: "iframe",
    aspect: "fluid",
    oembed: (u) =>
      `https://www.reddit.com/oembed?url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: /^embed\.reddit\.com\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "bluesky",
    label: "Bluesky",
    urlPattern: /^(?:https?:\/\/)?(?:www\.)?bsky\.app\/profile\/[^/]+\/post\//i,
    embedKind: "iframe",
    aspect: "fluid",
    oembed: (u) =>
      `https://embed.bsky.app/oembed?url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: /^embed\.bsky\.app\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "giphy",
    label: "Giphy",
    urlPattern:
      /^(?:https?:\/\/)?(?:www\.|media\.)?giphy\.com\/(?:gifs|clips)\//i,
    embedKind: "iframe",
    aspect: "fluid",
    oembed: (u) =>
      `https://giphy.com/services/oembed?url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: /^giphy\.com\/embed\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "spotify",
    label: "Spotify",
    urlPattern:
      /^(?:https?:\/\/)?(?:open\.)?spotify\.com\/(?:track|album|playlist|episode|show)\//i,
    embedKind: "iframe",
    aspect: "bar",
    oembed: (u) =>
      `https://open.spotify.com/oembed?url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: /^open\.spotify\.com\/embed\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "soundcloud",
    label: "SoundCloud",
    urlPattern: /^(?:https?:\/\/)?(?:www\.|m\.)?soundcloud\.com\//i,
    embedKind: "iframe",
    aspect: "bar",
    oembed: (u) =>
      `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(u.href)}`,
    constructIframeSrc: null,
    iframeSrcPattern: /^w\.soundcloud\.com\/player\//i,
    blockquoteClass: null,
    loader: null,
  },
  {
    id: "mastodon",
    label: "Mastodon",
    urlPattern: /^https?:\/\/[a-z0-9.-]+\/@[^/]+\/[0-9]+/i,
    embedKind: "iframe",
    aspect: "fluid",
    // Mastodon oEmbed varies per instance; the `/embed` path is the
    // documented, portable iframe form — build it directly from the URL.
    oembed: null,
    constructIframeSrc: (u) => `${u.origin}${u.pathname}/embed`,
    iframeSrcPattern: /^[a-z0-9.-]+\/@[^/]+\/[0-9]+\/embed(?:[/?#]|$)/i,
    blockquoteClass: null,
    loader: null,
  },
];

/** Normalize a raw user URL. Returns null if it can't be parsed. */
export function parsePostUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
}

/** Find the provider that handles a given post URL. */
export function matchProvider(rawUrl: string): OembedProvider | null {
  const postUrl = parsePostUrl(rawUrl);
  if (!postUrl) return null;
  for (const p of PROVIDERS) {
    if (p.urlPattern.test(postUrl.href)) return p;
  }
  return null;
}

/** Find the provider whose embed iframe src matches (used by the renderer). */
export function providerByIframeSrc(src: string): OembedProvider | null {
  const withoutProto = src.replace(/^https?:\/\//i, "");
  for (const p of PROVIDERS) {
    if (p.iframeSrcPattern?.test(withoutProto)) return p;
  }
  return null;
}

/**
 * Find the blockquote provider whose embed class appears in the given
 * className string (space-separated hast classes). Used by the renderer to
 * pick the right widget loader for hydration.
 */
export function providerByBlockquoteClass(
  className: string,
): OembedProvider | null {
  for (const p of PROVIDERS) {
    if (p.blockquoteClass && className.includes(p.blockquoteClass)) return p;
  }
  return null;
}

export function providerById(id: string): OembedProvider | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Compact list for UI hints (e.g. "Supported: YouTube, Vimeo, …"). */
export const SUPPORTED_PROVIDERS: readonly { id: string; label: string }[] =
  PROVIDERS.map((p) => ({ id: p.id, label: p.label }));

/**
 * Combined regex matching every provider's embed iframe src. Used by
 * `rehype-sanitize` to whitelist iframe `src` values — the single source of
 * truth shared by the sanitize schema and the renderer's defense-in-depth.
 */
const iframeSrcPatterns: string[] = [];
for (const p of PROVIDERS) {
  if (p.iframeSrcPattern) iframeSrcPatterns.push(p.iframeSrcPattern.source);
}
export const ALLOWED_IFRAME_SRC_RE = new RegExp(
  `^https:\\/\\/(?:${iframeSrcPatterns.map((s) => `(?:${s})`).join("|")})`,
  "i",
);

/** Normalized result returned by the `oembed` action and consumed by the UI. */
export type EmbedResult = {
  provider: string;
  url: string;
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  /** Raw HTML to insert into the markdown (iframe or blockquote, scripts stripped). */
  embedHtml: string;
};
