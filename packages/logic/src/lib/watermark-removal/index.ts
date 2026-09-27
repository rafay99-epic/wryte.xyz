import { removeWatermarkFromImageData } from "@pilio/gemini-watermark-remover/image-data";
import { MAX_DECODE_PIXELS } from "@wryte/logic/lib/image-compression/index";

export type WatermarkResult = {
  file: File;
  wasApplied: boolean;
};

const MIN_DIMENSION = 200;

function passthrough(file: File): WatermarkResult {
  return { file, wasApplied: false };
}

export async function removeWatermark(
  file: File,
  options?: { signal?: AbortSignal },
): Promise<WatermarkResult> {
  if (!file.type.startsWith("image/")) return passthrough(file);
  if (
    file.type !== "image/png" &&
    file.type !== "image/jpeg" &&
    file.type !== "image/webp"
  ) {
    return passthrough(file);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    return passthrough(file);
  }

  const { width, height } = bitmap;

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    bitmap.close();
    return passthrough(file);
  }
  if (width * height > MAX_DECODE_PIXELS) {
    bitmap.close();
    return passthrough(file);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return passthrough(file);
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);

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
