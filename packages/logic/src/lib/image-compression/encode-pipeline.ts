import { applyRoundedCornerMask } from "./rounded-corners";
import type { ResolvedFormat } from "./types";

export type EncodeTask = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  format: ResolvedFormat;
  quality: number;
  flattenWhite: boolean;
  cornerRadius: number;
};

export type EncodeResult = {
  blob: Blob;
  width: number;
  height: number;
  resolvedFormat: ResolvedFormat;
};

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
