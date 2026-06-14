/**
 * Social announcement template helpers.
 *
 * The textarea in the publish/schedule flows holds a *template* containing
 * `{{title}}` / `{{url}}` placeholders. They are resolved server-side at
 * publish time (so a scheduled post always uses the title/URL as they exist
 * when it actually goes out). This mirror lets the UI render a live preview
 * of the resolved text. Keep it in sync with `renderPostTemplate` in
 * `convex/social/post.ts`.
 */

export const DEFAULT_SOCIAL_TEMPLATE = "New blog post: {{title}}\n\n{{url}}";

export type SocialTemplateVars = {
  title: string;
  url: string;
};

/** Replace the supported `{{title}}` / `{{url}}` placeholders. */
export function renderSocialText(
  template: string,
  vars: SocialTemplateVars,
): string {
  return template
    .replace(/\{\{title\}\}/g, vars.title)
    .replace(/\{\{url\}\}/g, vars.url);
}

/** Build the canonical public URL for a document slug under a site URL. */
export function buildPublishedUrl(
  siteUrl: string | undefined | null,
  slug: string | undefined | null,
): string {
  if (!siteUrl) return "";
  return `${siteUrl.replace(/\/$/, "")}/${slug ?? "untitled"}`;
}
