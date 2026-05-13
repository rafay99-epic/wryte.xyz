import { applyRoundedCornerMask } from "./rounded-corners";
import type { ResolvedFormat } from "./types";

/**
 * Shared encode logic used by both the Web Worker and the main-thread
 * fallback in `worker-client.ts`. Keeping a single implementation here
 * prevents the two paths from drifting.
 *
 * The pipeline:
 *  1. Allocate an OffscreenCanvas at the target dimensions.
 *  2. Optionally fill with white (JPEG target on a transparent source).
 *  3. Draw the decoded bitmap.
 *  4. Apply the rounded-corner mask if requested.
 *  5. Encode to the target format. Rounded corners force PNG so the mask
 *     survives; everything else honours the caller's chosen format.
 *
 * Bitmap ownership: this function does NOT close the bitmap — that's the
 * caller's responsibility (worker closes after postMessage, main-thread
 * fallback closes in `finally`).
 */
export interface EncodeTask {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  format: ResolvedFormat;
  /** 0.1–1.0; ignored for PNG. */
  quality: number;
  /** Fill canvas white before drawImage. Used for transparent → JPEG. */
  flattenWhite: boolean;
  /** Px; 0 disables. Forces PNG output regardless of `format`. */
  cornerRadius: number;
}

export interface EncodeResult {
  blob: Blob;
  width: number;
  height: number;
  resolvedFormat: ResolvedFormat;
}

export async function runEncodePipeline(
  task: EncodeTask,
): Promise<EncodeResult> {
  const canvas = new OffscreenCanvas(task.width, task.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to acquire 2D canvas context");

  if (task.flattenWhite) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, task.width, task.height);
  }
  ctx.drawImage(task.bitmap, 0, 0, task.width, task.height);

  const resolvedFormat: ResolvedFormat =
    task.cornerRadius > 0 ? "png" : task.format;
  if (task.cornerRadius > 0) {
    applyRoundedCornerMask(canvas, task.cornerRadius);
  }

  const blob = await encodeNative(canvas, resolvedFormat, task.quality);
  return { blob, width: task.width, height: task.height, resolvedFormat };
}

async function encodeNative(
  canvas: OffscreenCanvas,
  format: ResolvedFormat,
  quality: number,
): Promise<Blob> {
  if (format === "png") {
    return canvas.convertToBlob({ type: "image/png" });
  }
  return canvas.convertToBlob({
    type: format === "jpeg" ? "image/jpeg" : "image/webp",
    quality,
  });
}
