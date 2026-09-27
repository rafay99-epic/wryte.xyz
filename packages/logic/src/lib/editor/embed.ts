import type { EmbedResult } from "@wryte/backend/integrations/oembedProviders";

export function embedMarkup(result: EmbedResult): string {
  return `\n\n${result.embedHtml.trim()}\n\n`;
}
