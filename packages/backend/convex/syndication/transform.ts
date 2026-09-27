export function stripLeadingFrontmatter(markdown: string): string {
  const match = markdown.match(
    /^(?:---\n[\s\S]*?\n---|\+\+\+\n[\s\S]*?\n\+\+\+)\s*\n?/,
  );
  return match ? markdown.slice(match[0].length) : markdown;
}

export function absolutizeUrls(markdown: string, canonicalUrl: string): string {
  let origin: string;
  try {
    origin = new URL(canonicalUrl).origin;
  } catch {
    return markdown;
  }
  return markdown.replace(/(\]\()(\/(?!\/)[^)\s]*)/g, `$1${origin}$2`);
}

export function escapeLiquidForDevto(markdown: string): string {
  if (!/\{%/.test(markdown)) return markdown;
  const cleaned = markdown.replace(/\{%-?\s*(?:end)?raw\s*-?%\}/g, "");
  return `{% raw %}\n${cleaned}\n{% endraw %}`;
}

export function normalizeDevtoTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const normalized = tag
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30);
    if (normalized) seen.add(normalized);
    if (seen.size === 4) break;
  }
  return [...seen];
}

export function toHashnodeTags(
  tags: string[],
): { name: string; slug: string }[] {
  const seen = new Set<string>();
  const result: { name: string; slug: string }[] = [];
  for (const tag of tags) {
    const name = tag.trim();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    result.push({ name, slug });
  }
  return result;
}

export function prepareBody(opts: {
  content: string;
  canonicalUrl: string;
  platform: "devto" | "hashnode";
}): string {
  let body = stripLeadingFrontmatter(opts.content);
  body = absolutizeUrls(body, opts.canonicalUrl);
  if (opts.platform === "devto") body = escapeLiquidForDevto(body);
  return body;
}

export function coverImageFromFrontmatter(
  frontmatterJson: string | undefined,
  canonicalUrl: string,
): string | undefined {
  if (!frontmatterJson) return undefined;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(frontmatterJson) as Record<string, unknown>;
  } catch {
    return undefined;
  }
  for (const key of [
    "cover_image",
    "coverImage",
    "cover",
    "image",
    "heroImage",
    "banner",
  ]) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) {
      const url = value.trim();
      if (/^https?:\/\//.test(url)) return url;
      if (url.startsWith("/")) {
        try {
          return `${new URL(canonicalUrl).origin}${url}`;
        } catch {
          return undefined;
        }
      }
      return undefined;
    }
  }
  return undefined;
}
