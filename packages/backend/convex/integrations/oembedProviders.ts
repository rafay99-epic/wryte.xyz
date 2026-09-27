export type EmbedKind = "iframe" | "blockquote";
export type EmbedAspect = "video" | "bar" | "fluid";

export type EmbedLoader = {
  src: string;
  scriptId: string;
  isReady: () => boolean;
  render: (el: HTMLElement) => void;
};

export type OembedProvider = {
  id: string;
  label: string;
  urlPattern: RegExp;
  embedKind: EmbedKind;
  aspect: EmbedAspect;
  oembed: ((postUrl: URL) => string) | null;
  constructIframeSrc: ((postUrl: URL) => string) | null;
  iframeSrcPattern: RegExp | null;
  blockquoteClass: string | null;
  loader: EmbedLoader | null;
};

type TwitterGlobal = { widgets: { load: (el?: HTMLElement) => void } };
type TiktokGlobal = { lib: { render: (nodes: HTMLElement[]) => void } };

declare global {
  interface Window {
    twttr?: TwitterGlobal;
    tiktokEmbed?: TiktokGlobal;
  }
}

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
      isReady: () => Boolean(window.twttr?.widgets),
      render: (el) => {
        const widgets = window.twttr?.widgets;
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
      isReady: () => Boolean(window.tiktokEmbed?.lib),
      render: (el) => {
        const lib = window.tiktokEmbed?.lib;
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
    oembed: null,
    constructIframeSrc: (u) => `${u.origin}${u.pathname}/embed`,
    iframeSrcPattern: /^[a-z0-9.-]+\/@[^/]+\/[0-9]+\/embed(?:[/?#]|$)/i,
    blockquoteClass: null,
    loader: null,
  },
];

export function parsePostUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return null;
  }
}

export function matchProvider(rawUrl: string): OembedProvider | null {
  const postUrl = parsePostUrl(rawUrl);
  if (!postUrl) return null;
  for (const p of PROVIDERS) {
    if (p.urlPattern.test(postUrl.href)) return p;
  }
  return null;
}

export function providerByIframeSrc(src: string): OembedProvider | null {
  const withoutProto = src.replace(/^https?:\/\//i, "");
  for (const p of PROVIDERS) {
    if (p.iframeSrcPattern?.test(withoutProto)) return p;
  }
  return null;
}

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

export const SUPPORTED_PROVIDERS: readonly { id: string; label: string }[] =
  PROVIDERS.map((p) => ({ id: p.id, label: p.label }));

const iframeSrcPatterns: string[] = [];
for (const p of PROVIDERS) {
  if (p.iframeSrcPattern) iframeSrcPatterns.push(p.iframeSrcPattern.source);
}
export const ALLOWED_IFRAME_SRC_RE = new RegExp(
  `^https:\\/\\/(?:${iframeSrcPatterns.map((s) => `(?:${s})`).join("|")})`,
  "i",
);

export type EmbedResult = {
  provider: string;
  url: string;
  title: string | null;
  authorName: string | null;
  authorUrl: string | null;
  thumbnailUrl: string | null;
  embedHtml: string;
};
