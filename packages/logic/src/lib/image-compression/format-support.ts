import type { ResolvedFormat } from "./types";

export type FormatSupport = {
  webp: boolean;
};

let cached: Promise<FormatSupport> | null = null;

export function detectFormatSupport(): Promise<FormatSupport> {
  if (cached) return cached;
  cached = (async () => {
    if (typeof OffscreenCanvas === "undefined") {
      return { webp: false };
    }
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 1, 1);
    }
    const webp = await canCanvasEncode(canvas, "image/webp");
    return { webp };
  })();
  return cached;
}

async function canCanvasEncode(
  canvas: OffscreenCanvas,
  mime: string,
): Promise<boolean> {
  try {
    const blob = await canvas.convertToBlob({ type: mime });
    return blob.type === mime;
  } catch {
    return false;
  }
}

export function pickAutoFormat(support: FormatSupport): ResolvedFormat {
  if (support.webp) return "webp";
  return "jpeg";
}
