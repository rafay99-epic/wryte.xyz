/**
 * Social announcement helpers for the client.
 *
 * URL construction and final-text composition live in
 * `convex/_lib/publishedUrl.ts` (plain TypeScript, no server imports) and
 * are re-exported here so the live previews in the publish/schedule dialogs
 * are guaranteed to match what the server actually posts.
 */

export {
  buildPublishedUrl,
  composeAnnouncementText,
  defaultPostUrlPrefix,
} from "../../convex/_lib/publishedUrl";

export type SocialTemplateVars = {
  title: string;
  url: string;
};
