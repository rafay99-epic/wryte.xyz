/**
 * Markdown → email HTML. `marked` gives us a reliable HTML string
 * server-side (react-markdown is client-only). Relative image/link URLs are
 * absolutized against the site origin so they don't break in an inbox, and
 * a leading frontmatter block is stripped (a newsletter isn't a repo file).
 */

import { marked } from "marked";

function stripLeadingFrontmatter(markdown: string): string {
  const match = markdown.match(
    /^(?:---\n[\s\S]*?\n---|\+\+\+\n[\s\S]*?\n\+\+\+)\s*\n?/,
  );
  return match ? markdown.slice(match[0].length) : markdown;
}

function absolutizeUrls(markdown: string, origin: string | undefined): string {
  if (!origin) return markdown;
  return markdown.replace(/(\]\()(\/(?!\/)[^)\s]*)/g, `$1${origin}$2`);
}

/**
 * Render a newsletter body to an HTML string. `siteOrigin` (optional) is the
 * scheme+host used to absolutize relative links, e.g. from the source post's
 * canonical URL.
 */
export function renderNewsletterHtml(
  markdown: string,
  siteOrigin?: string,
  preheader?: string,
): string {
  const cleaned = absolutizeUrls(stripLeadingFrontmatter(markdown), siteOrigin);
  const inner = marked.parse(cleaned, { async: false, gfm: true }) as string;
  // Hidden preheader — the inbox snippet, invisible in the body.
  const pre = preheader?.trim()
    ? `<span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">${escapeHtml(preheader.trim())}</span>`
    : "";
  // A minimal, email-safe wrapper — providers apply their own template chrome.
  return `${pre}<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:640px;margin:0 auto;">${inner}</div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function siteOriginOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
