export function defaultPostUrlPrefix(
  framework: string | null | undefined,
): string {
  switch (framework) {
    case "hugo":
      return "posts";
    default:
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

export const SERVICE_TEXT_LIMITS: Record<string, number> = {
  twitter: 280,
  x: 280,
  bluesky: 300,
  mastodon: 500,
  threads: 500,
};

export function composeForService(
  service: string,
  opts: { title: string; url: string; customText?: string | undefined },
): string {
  const full = composeAnnouncementText(opts);
  const limit = SERVICE_TEXT_LIMITS[service.toLowerCase()];
  if (!limit || full.length <= limit) return full;

  const prose = full.replace(opts.url, "").replace(/\s+$/, "");
  const budget = limit - opts.url.length - 3;
  if (budget <= 0) return opts.url.slice(0, limit);
  return `${prose.slice(0, budget).replace(/\s+\S*$/, "")}…\n\n${opts.url}`;
}
