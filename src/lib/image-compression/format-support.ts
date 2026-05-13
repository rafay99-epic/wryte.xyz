import type { ResolvedFormat } from "./types";

/**
 * Probes the browser for native encoder support for WebP. Used by the
 * `"auto"` format picker — when WebP is supported we pick it for the size
 * win, otherwise we fall back to JPEG which is universal.
 *
 * Detection runs once per session and is memoized; subsequent calls reuse
 * the same Promise.
 */
export interface FormatSupport {
  webp: boolean;
}

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

/** Picks the smallest practical format the browser can natively encode. */
export function pickAutoFormat(support: FormatSupport): ResolvedFormat {
  if (support.webp) return "webp";
  return "jpeg";
}
