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
  composeForService,
  defaultPostUrlPrefix,
  SERVICE_TEXT_LIMITS,
} from "../../convex/_lib/publishedUrl";

export type SocialTemplateVars = {
  title: string;
  url: string;
};

export type BufferChannelInfo = {
  id: string;
  service: string;
  name: string;
};

/** Pretty labels for Buffer's `service` enum on connected channels. */
export const BUFFER_SERVICE_LABELS: Record<string, string> = {
  twitter: "X (Twitter)",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  bluesky: "Bluesky",
  threads: "Threads",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  mastodon: "Mastodon",
  googlebusiness: "Google Business",
};

export function bufferServiceLabel(service: string): string {
  return BUFFER_SERVICE_LABELS[service.toLowerCase()] ?? service;
}

/**
 * Client mirror of the Buffer credential `publicConfig` JSON:
 * `{ channels, enabledChannelIds }`. Returns only the ENABLED channels —
 * the set announcements will actually go to.
 */
export function parseEnabledChannels(
  raw: string | undefined,
): BufferChannelInfo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as {
      channels?: BufferChannelInfo[];
      enabledChannelIds?: string[];
    };
    if (!Array.isArray(parsed.channels)) return [];
    const enabled = new Set(parsed.enabledChannelIds ?? []);
    return parsed.channels.filter((c) => enabled.has(c.id));
  } catch {
    return [];
  }
}
