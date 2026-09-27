import { MAX_DECODE_PIXELS, MIN_SAVINGS_RATIO, withDefaults } from "./defaults";
import { detectFormatSupport, pickAutoFormat } from "./format-support";
import {
  extensionFromFormat,
  hasTransparency,
  isCompressible,
  mimeFromFormat,
  rewriteFilename,
} from "./mime";
import type {
  CompressionResult,
  CompressionSettings,
  CompressionStats,
  ResolvedFormat,
} from "./types";
import { encodeInWorker } from "./worker-client";

export async function compressImageFile(
  file: File,
  settings: Partial<CompressionSettings>,
): Promise<CompressionResult> {
  const resolved = withDefaults(settings);

  if (!resolved.enabled) {
    return passthrough(file, "disabled");
  }
  if (!isCompressible(file.type)) {
    return passthrough(file, "unsupported-mime");
  }
  if (file.size < resolved.skipThresholdBytes) {
    return passthrough(file, "below-threshold");
  }

  const start =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
  } catch {
    return passthrough(file, "decode-failed");
  }

  if (bitmap.width * bitmap.height > MAX_DECODE_PIXELS) {
    bitmap.close();
    return passthrough(file, "decode-failed");
  }

  const width = bitmap.width;
  const height = bitmap.height;

  const targetFormat = await resolveFormat(resolved.format);

  const flattenWhite = targetFormat === "jpeg" && hasTransparency(file.type);
  const cornerRadius = resolved.roundedCorners
    ? Math.max(0, Math.round(resolved.cornerRadius))
    : 0;

  const response = await encodeInWorker({
    bitmap,
    width,
    height,
    format: targetFormat,
    quality: clampQuality(resolved.quality),
    flattenWhite,
    cornerRadius,
  });

  if (!response.ok) {
    console.warn(`[image-compression] encode failed: ${response.error}`);
    return passthrough(file, "encode-failed");
  }

  const outMime = mimeFromFormat(response.resolvedFormat);
  const outputBytes = response.blob.size;
  const isFormatChange = outMime !== file.type;
  const isVisualChange = cornerRadius > 0;
  if (
    !isFormatChange &&
    !isVisualChange &&
    outputBytes >= file.size * (1 - MIN_SAVINGS_RATIO)
  ) {
    return passthrough(file, "already-optimal");
  }

  const outName = rewriteFilename(
    file.name,
    extensionFromFormat(response.resolvedFormat),
  );
  const outFile = new File([response.blob], outName, {
    type: outMime,
    lastModified: Date.now(),
  });

  const end =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const stats: CompressionStats = {
    originalBytes: file.size,
    outputBytes,
    savedBytes: file.size - outputBytes,
    savedRatio: 1 - outputBytes / file.size,
    outputMime: outMime,
    durationMs: Math.round(end - start),
    resolvedFormat: response.resolvedFormat,
  };

  return { file: outFile, skipped: null, stats };
}

function passthrough(
  file: File,
  reason: CompressionResult["skipped"],
): CompressionResult {
  return { file, skipped: reason, stats: null };
}

function clampQuality(q: number): number {
  if (!Number.isFinite(q)) return 0.82;
  return Math.min(1, Math.max(0.1, q));
}

async function resolveFormat(
  format: CompressionSettings["format"],
): Promise<ResolvedFormat> {
  if (format === "auto") {
    return pickAutoFormat(await detectFormatSupport());
  }
  if (format === "avif") {
    return "webp";
  }
  return format;
}
