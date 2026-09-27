import { escapeHtmlAttribute } from "@wryte/logic/lib/escape";

const VIDEO_FILE_RE = /\.(mp4|webm|mov|m4v|ogv|ogg)$/i;

export function isVideoFilename(name: string): boolean {
  return VIDEO_FILE_RE.test(name);
}

export function videoEmbedMarkup(url: string, title?: string): string {
  const titleAttr = title?.trim()
    ? ` title="${escapeHtmlAttribute(title.trim())}"`
    : "";
  return `<video controls preload="metadata" src="${escapeHtmlAttribute(url.trim())}"${titleAttr}></video>`;
}
