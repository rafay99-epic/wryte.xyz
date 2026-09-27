export {
  buildPublishedUrl,
  composeAnnouncementText,
  composeForService,
  defaultPostUrlPrefix,
  SERVICE_TEXT_LIMITS,
} from "@wryte/backend/_lib/publishedUrl";

export type SocialTemplateVars = {
  title: string;
  url: string;
};

export type BufferChannelInfo = {
  id: string;
  service: string;
  name: string;
};

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
