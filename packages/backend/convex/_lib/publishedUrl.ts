/**
 * Canonical public URL for a published post, and the announcement text
 * built from it.
 *
 * The URL is `{siteUrl}/{prefix}/{slug}` where the prefix is the project's
 * `postUrlPrefix` when set (empty string = posts at the site root), falling
 * back to a framework-appropriate default. Mirrored client-side in
 * `src/lib/social-template.ts` for live previews — keep the two in sync.
 */

/** Default blog-path segment per static-site framework. */
export function defaultPostUrlPrefix(
  framework: string | null | undefined,
): string {
  switch (framework) {
    case "hugo":
      return "posts";
    default:
      // astro, nextjs, gatsby, jekyll, eleventy, unknown — "/blog" is the
      // overwhelmingly common convention.
      return "blog";
  }
}

function trimSlashes(segment: string): string {
  return segment.replace(/^\/+|\/+$/g, "");
}

export function buildPublishedUrl(opts: {
  siteUrl: string;
  slug: string;
  postUrlPrefix?: string | undefined;
  framework?: string | null | undefined;
}): string {
  const base = opts.siteUrl.replace(/\/+$/, "");
  const prefix = trimSlashes(
    opts.postUrlPrefix ?? defaultPostUrlPrefix(opts.framework),
  );
  const slug = trimSlashes(opts.slug);
  return prefix ? `${base}/${prefix}/${slug}` : `${base}/${slug}`;
}

/**
 * Final announcement text. A custom message (from the publish/schedule
 * dialog) wins; `{{title}}`/`{{url}}` placeholders inside it still resolve
 * for backward compatibility, and the post URL is appended if the message
 * doesn't already contain it — an announcement without its link is useless.
 * No custom message → fully automated title + URL.
 */
export function composeAnnouncementText(opts: {
  title: string;
  url: string;
  customText?: string | undefined;
}): string {
  const custom = opts.customText?.trim();
  if (!custom) return `New blog post: ${opts.title}\n\n${opts.url}`;
  let text = custom
    .replace(/\{\{title\}\}/g, opts.title)
    .replace(/\{\{url\}\}/g, opts.url);
  if (opts.url && !text.includes(opts.url)) text = `${text}\n\n${opts.url}`;
  return text;
}

/**
 * Character budgets for services that hard-truncate or reject long posts.
 * Services without an entry (LinkedIn, Facebook, …) take the full text.
 * X counts any URL as 23 chars — using its real length here is strictly
 * conservative, so a text that fits by our count always fits for real.
 */
export const SERVICE_TEXT_LIMITS: Record<string, number> = {
  twitter: 280,
  x: 280,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
};

/**
 * The announcement, shaped for one service: short-form platforms get the
 * prose trimmed with an ellipsis while the URL always survives intact.
 */
export function composeForService(
  service: string,
  opts: { title: string; url: string; customText?: string | undefined },
): string {
  const full = composeAnnouncementText(opts);
  const limit = SERVICE_TEXT_LIMITS[service.toLowerCase()];
  if (!limit || full.length <= limit) return full;

  // Trim prose, never the link. The URL is re-appended on its own line.
  const prose = full.replace(opts.url, "").replace(/\s+$/, "");
  const budget = limit - opts.url.length - 3; // "…" + "\n\n"
  if (budget <= 0) return opts.url.slice(0, limit);
  return `${prose.slice(0, budget).replace(/\s+\S*$/, "")}…\n\n${opts.url}`;
}
