import type { NoteRef, RefKind } from "@wryte/backend/cms/notes/_lib/model";

export const REF_KINDS = [
  "pr",
  "issue",
  "comment",
  "link",
] as const satisfies readonly RefKind[];

export const REF_KIND_LABELS: Record<RefKind, string> = {
  pr: "Pull request",
  issue: "Issue",
  comment: "Comment",
  link: "Link",
};

const GITHUB_ITEM = /^\/([^/]+)\/([^/]+)\/(?:pull|issues)\/(\d+)/;

export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function urlLabel(value: string): string {
  try {
    const url = new URL(value);
    const item =
      url.hostname === "github.com" && GITHUB_ITEM.exec(url.pathname);
    if (item) return `${item[1]}/${item[2]}#${item[3]}`;
    const path = url.pathname.replace(/\/$/, "");
    return `${url.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return value;
  }
}

export function refLabel(ref: Pick<NoteRef, "url" | "text">): string {
  if (ref.text) return ref.text;
  return ref.url ? urlLabel(ref.url) : "";
}
