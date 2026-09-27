/**
 * Gemini watermark removal — browser-side tool that detects and removes the
 * Gemini AI watermark (bottom-right logo) from uploaded images before they
 * leave the client.
 *
 * Works on `ImageData` via the `@pilio/gemini-watermark-remover` library.
 * The pipeline:
 *   File → draw to OffscreenCanvas → get ImageData → detect & remove →
 *   put modified ImageData back → canvas.toBlob() → new File
 *
 * If no watermark is detected the original file passes through unchanged (no
 * canvas round-trip, no re-encoding). If removal throws, the original file is
 * returned with a console.warn — we never block an upload.
 */

import { removeWatermarkFromImageData } from "@pilio/gemini-watermark-remover/image-data";
import { MAX_DECODE_PIXELS } from "@wryte/logic/lib/image-compression/index";

export type WatermarkResult = {
  /** The file after watermark removal (may be the original if none was found). */
  file: File;
  /** True when a Gemini watermark was detected and removed. */
  wasApplied: boolean;
};

/**
 * Minimum image dimension (pixels) for watermark detection. Tiny images
 * (icons, avatars) won't have a Gemini watermark.
 */
const MIN_DIMENSION = 200;

/**
 * Passes through without processing — no canvas round-trip or re-encode.
 */
function passthrough(file: File): WatermarkResult {
  return { file, wasApplied: false };
}

/**
 * Detect and remove the Gemini watermark from an image `File`.
 *
 * @param file - The image file (typically post-compression).
 * @param options.signal - Optional AbortSignal to cancel processing.
 */
export async function removeWatermark(
  file: File,
  options?: { signal?: AbortSignal },
): Promise<WatermarkResult> {
  if (!file.type.startsWith("image/")) return passthrough(file);
  // Only PNG, JPEG, and WebP can carry a Gemini watermark.
  if (
    file.type !== "image/png" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/webp"
  ) {
    return passthrough(file);
  }

  // ---- decode ----------------------------------------------------------
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    return passthrough(file);
  }

  const { width, height } = bitmap;

  // Skip tiny images or very large ones.
  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    bitmap.close();
    return passthrough(file);
  }
  // Same pixel cap as the compression pipeline; anything bigger skips detection.
  if (width * height > MAX_DECODE_PIXELS) {
    bitmap.close();
    return passthrough(file);
  }

  // ---- canvas work -----------------------------------------------------
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return passthrough(file);
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);

  // ---- detect & remove -------------------------------------------------
  let result: Awaited<ReturnType<typeof removeWatermarkFromImageData>>;

  try {
    if (options?.signal?.aborted) return passthrough(file);
    result = await removeWatermarkFromImageData(imageData);
  } catch (err) {
    console.warn("[watermark-removal] detection failed, passing through:", err);
    return passthrough(file);
  }

  if (!result.meta.applied) {
    return passthrough(file);
  }

  // ---- re-encode -------------------------------------------------------
  // The library clones real `ImageData` inputs as `ImageData`; the fallback
  // only covers its plain-object branch.
  const cleaned =
    result.imageData instanceof ImageData
      ? result.imageData
      : new ImageData(
          new Uint8ClampedArray(result.imageData.data),
          result.imageData.width,
          result.imageData.height,
        );
  ctx.putImageData(cleaned, 0, 0);

  let blob: Blob;
  try {
    // Keep the original mime type to avoid format shifts.
    blob = await canvas.convertToBlob({ type: file.type });
  } catch {
    return passthrough(file);
  }

  if (blob.size === 0) return passthrough(file);

  const outFile = new File([blob], file.name, {
    type: file.type,
    lastModified: Date.now(),
  });

  return { file: outFile, wasApplied: true };
}
