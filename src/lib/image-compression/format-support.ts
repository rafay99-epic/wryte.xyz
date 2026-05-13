import type { ResolvedFormat } from "./types";

/**
 * Probes the browser for native encoder support for WebP and AVIF. Used
 * exclusively by the `"auto"` format picker — explicit format choices are
 * honoured even when native support is missing (AVIF falls through to the
 * `@jsquash/avif` WASM codec inside the worker).
 *
 * Detection runs once per session and is memoized; subsequent calls reuse
 * the same Promise.
 */
export interface FormatSupport {
  webp: boolean;
  avif: boolean;
}

let cached: Promise<FormatSupport> | null = null;

export function detectFormatSupport(): Promise<FormatSupport> {
  if (cached) return cached;
  cached = (async () => {
    if (typeof OffscreenCanvas === "undefined") {
      return { webp: false, avif: false };
    }
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 1, 1);
    }
    const [webp, avif] = await Promise.all([
      canCanvasEncode(canvas, "image/webp"),
      canCanvasEncode(canvas, "image/avif"),
    ]);
    return { webp, avif };
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

/**
 * Picks the smallest practical format the browser can natively encode. We
 * intentionally do not consider WASM-only AVIF here so `"auto"` stays
 * lightweight — users who want AVIF on Firefox can pick it explicitly and
 * accept the ~200 KB codec download.
 */
export function pickAutoFormat(support: FormatSupport): ResolvedFormat {
  if (support.avif) return "avif";
  if (support.webp) return "webp";
  return "jpeg";
}
