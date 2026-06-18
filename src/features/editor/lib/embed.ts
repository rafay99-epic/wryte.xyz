/**
 * Post-embed markup helpers shared by the insert dialog and previews.
 *
 * The `oembed` action returns portable raw HTML (an `<iframe>` for iframe
 * providers, a `<blockquote class="twitter-tweet">` for Twitter/X). We drop
 * it into the markdown as raw HTML — the same approach as `<video>` embeds.
 * rehype-raw parses it, rehype-sanitize whitelists the embed domains, and the
 * preview's component overrides render it. On publish to GitHub the raw HTML
 * travels with the document and renders on any static site that allows it.
 */

import type { EmbedResult } from "../../../../convex/integrations/oembedProviders";

/**
 * Markdown to insert for a resolved embed. Surrounding blank lines keep the
 * raw HTML block isolated so it renders as its own block.
 */
export function embedMarkup(result: EmbedResult): string {
  return `\n\n${result.embedHtml.trim()}\n\n`;
}
