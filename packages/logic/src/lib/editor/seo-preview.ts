export const GOOGLE_TITLE_LIMIT_PX = 600;
export const GOOGLE_DESCRIPTION_LIMIT_PX = 920;

const TITLE_FONT = "20px arial, sans-serif";
const DESCRIPTION_FONT = "14px arial, sans-serif";

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

function measureWidth(text: string, font: string): number {
  const ctx = getMeasureContext();
  if (ctx) {
    ctx.font = font;
    return ctx.measureText(text).width;
  }
  const size = Number.parseInt(font, 10) || 16;
  return text.length * size * 0.47;
}

export type SerpTextCheck = {
  widthPx: number;
  limitPx: number;
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

export function pickImageValue(
  values: Record<string, string | boolean>,
): string | null {
  for (const key of IMAGE_FIELD_CANDIDATES) {
    const v = values[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

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
    } catch {}
  }
  const crumbs = [...basePath, ...slug.split("/").filter(Boolean)];
  return { host, crumbs, hasSite };
}
