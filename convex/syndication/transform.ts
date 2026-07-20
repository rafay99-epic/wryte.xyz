/**
 * Pure markdown transforms applied before pushing a post to an external
 * platform. Both platforms render the markdown on their own domain, so
 * everything site-relative must become absolute, and platform-specific
 * syntax (dev.to Liquid, dev.to frontmatter-in-body) must be neutralized.
 * No runtime deps — trivially unit-testable.
 */

/**
 * Strip a leading YAML (`---`) or TOML (`+++`) frontmatter block. dev.to
 * parses leading YAML in `body_markdown` and lets it OVERRIDE the JSON
 * fields we send — the body must always arrive clean.
 */
export function stripLeadingFrontmatter(markdown: string): string {
  const match = markdown.match(
    /^(?:---\n[\s\S]*?\n---|\+\+\+\n[\s\S]*?\n\+\+\+)\s*\n?/,
  );
  return match ? markdown.slice(match[0].length) : markdown;
}

/**
 * Rewrite site-relative image/link URLs (`](/img/x.png)`) to absolute URLs
 * on the post's canonical origin. Protocol-relative and anchor links are
 * left alone; both platforms break on relative paths otherwise.
 */
export function absolutizeUrls(markdown: string, canonicalUrl: string): string {
  let origin: string;
  try {
    origin = new URL(canonicalUrl).origin;
  } catch {
    return markdown;
  }
  return markdown.replace(/(\]\()(\/(?!\/)[^)\s]*)/g, `$1${origin}$2`);
}

/**
 * Neutralize Liquid syntax for dev.to — raw `{% … %}` in user content is
 * interpreted as a Liquid tag (or 422s on unknown tags), including inside
 * code fences. Wrapping the whole body in `{% raw %}` disables Liquid
 * processing while leaving markdown rendering untouched.
 */
// ponytail: whole-body raw-wrap kills intentional dev.to embeds too; per-block
// escaping if a user ever asks for {% embed %} support.
export function escapeLiquidForDevto(markdown: string): string {
  if (!/\{%/.test(markdown)) return markdown;
  const cleaned = markdown.replace(/\{%-?\s*(?:end)?raw\s*-?%\}/g, "");
  return `{% raw %}\n${cleaned}\n{% endraw %}`;
}

/**
 * dev.to tag rules (Forem source, `app/models/tag.rb`): alphanumeric only,
 * ≤30 chars, max 4 tags. `next-js` → `nextjs`.
 */
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

/**
 * Hashnode tags must be `{ name, slug }` objects — plain strings are
 * rejected. New tags are auto-created from the pair.
 */
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

/** Full body pipeline for one platform. */
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

/**
 * Cover image from the document's frontmatter, absolutized. Checks the
 * common field names across frameworks; returns undefined when none found.
 */
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
      // Bare relative path ("images/x.png") — can't resolve reliably; skip.
      return undefined;
    }
  }
  return undefined;
}
