/**
 * Pure helpers for the search/social preview in the frontmatter editor.
 * Everything here is client-side math over values the editor already holds —
 * no network, no backend cost.
 */

/** Google desktop truncates titles at ~600px rendered in ~20px Arial. */
export const GOOGLE_TITLE_LIMIT_PX = 600;
/** Google desktop descriptions get ~920px across up to two 14px lines. */
export const GOOGLE_DESCRIPTION_LIMIT_PX = 920;

const TITLE_FONT = "20px arial, sans-serif";
const DESCRIPTION_FONT = "14px arial, sans-serif";

/** Frontmatter keys commonly used for the social/OG image, in priority order. */
const IMAGE_FIELD_CANDIDATES = [
  "ogImage",
  "socialImage",
  "image",
  "coverImage",
  "cover",
  "heroImage",
  "thumbnail",
];

let measureContext: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureContext !== undefined) return measureContext;
  if (typeof document === "undefined") {
    measureContext = null;
    return measureContext;
  }
  measureContext = document.createElement("canvas").getContext("2d");
  return measureContext;
}

/**
 * Approximate rendered pixel width of `text` in the given CSS font.
 * Falls back to a character-count heuristic when canvas is unavailable.
 */
function measureWidth(text: string, font: string): number {
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = font;
    return ctx.measureText(text).width;
  }
  // ~9px average glyph width at 20px Arial, scaled by the font size.
  const size = Number.parseInt(font, 10) || 16;
  return text.length * size * 0.47;
}

export type SerpTextCheck = {
  /** Rendered width in px (approximate). */
  widthPx: number;
  /** The limit this text is checked against. */
  limitPx: number;
  /** True when Google would truncate it. */
  truncated: boolean;
};

export function checkTitle(title: string): SerpTextCheck {
  const widthPx = measureWidth(title, TITLE_FONT);
  return {
    widthPx,
    limitPx: GOOGLE_TITLE_LIMIT_PX,
    truncated: widthPx > GOOGLE_TITLE_LIMIT_PX,
  };
}

export function checkDescription(description: string): SerpTextCheck {
  const widthPx = measureWidth(description, DESCRIPTION_FONT);
  return {
    widthPx,
    limitPx: GOOGLE_DESCRIPTION_LIMIT_PX,
    truncated: widthPx > GOOGLE_DESCRIPTION_LIMIT_PX,
  };
}

/** First image-like frontmatter value present, if any. */
export function pickImageValue(
  values: Record<string, string | boolean>,
): string | null {
  for (const key of IMAGE_FIELD_CANDIDATES) {
    const v = values[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/**
 * Breadcrumb-style display URL the way Google renders it:
 * `example.com › blog › my-post`. Site URL is optional — a placeholder
 * domain keeps the preview honest about what's still unconfigured.
 */
export function buildDisplayUrl(
  siteUrl: string | null | undefined,
  slug: string,
): { host: string; crumbs: string[]; hasSite: boolean } {
  let host = "your-site.com";
  let basePath: string[] = [];
  let hasSite = false;
  if (siteUrl?.trim()) {
    try {
      const url = new URL(
        siteUrl.includes("://") ? siteUrl : `https://${siteUrl}`,
      );
      host = url.host;
      basePath = url.pathname.split("/").filter(Boolean);
      hasSite = true;
    } catch {
      // Malformed site URL — keep the placeholder.
    }
  }
  const crumbs = [...basePath, ...slug.split("/").filter(Boolean)];
  return { host, crumbs, hasSite };
}
