/**
 * Minimal attribute-value escape for generated HTML tags.
 * Shared by the video and post-embed markup builders so both insert raw HTML
 * into the markdown with the same, safe quoting.
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}
