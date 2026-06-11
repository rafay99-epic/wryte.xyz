/**
 * Video embed helpers shared by the insert dialog and the previews.
 *
 * Markdown has no native video syntax, so we embed a raw `<video>` tag —
 * the portable form that GitHub, most static-site renderers, and our own
 * previews (markdown via rehype-raw, MDX natively) all understand.
 */

/** File extensions we treat as playable video when filtering media lists. */
const VIDEO_FILE_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;

export function isVideoFilename(name: string): boolean {
  return VIDEO_FILE_RE.test(name);
}

/** Minimal attribute-value escape for the generated HTML tag. */
function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

/**
 * Builds the `<video>` markup inserted into the document. `controls` and
 * `preload="metadata"` keep playback usable without eagerly downloading
 * the file; `title` doubles as the accessible label when provided.
 */
export function videoEmbedMarkup(url: string, title?: string): string {
  const titleAttr = title?.trim()
    ? ` title="${escapeAttribute(title.trim())}"`
    : "";
  return `<video controls preload="metadata" src="${escapeAttribute(url.trim())}"${titleAttr}></video>`;
}
