import { describe, expect, test } from "bun:test";
import {
  addBatchImages,
  BATCH_UPLOAD_CONCURRENCY,
  getUploadErrorMessage,
  MAX_BATCH_IMAGES,
  runUploadPool,
} from "../src/lib/batch-image-upload";

function image(name: string, type = "image/png"): File {
  return new File([name], name, { type, lastModified: 1 });
}

describe("batch image selection", () => {
  test("keeps supported unique images in order and caps the batch at ten", () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      image(`image-${index + 1}.png`),
    );
    files.splice(2, 0, image("notes.txt", "text/plain"));
    files.splice(4, 0, files[0]);

    const result = addBatchImages([], files);

    expect(result.items).toHaveLength(MAX_BATCH_IMAGES);
    expect(result.items.map((item) => item.file.name)).toEqual([
      "image-1.png",
      "image-2.png",
      "image-3.png",
      "image-4.png",
      "image-5.png",
      "image-6.png",
      "image-7.png",
      "image-8.png",
      "image-9.png",
      "image-10.png",
    ]);
    expect(result.issues.map((issue) => issue.kind)).toEqual([
      "unsupported",
      "duplicate",
      "limit",
      "limit",
    ]);
  });
});

describe("upload pool", () => {
  test("preserves results and limits active workers", async () => {
    let active = 0;
    let peak = 0;

    const results = await runUploadPool({
      items: [1, 2, 3, 4, 5],
      worker: async (value) => {
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        active -= 1;
        return value * 2;
      },
      concurrency: BATCH_UPLOAD_CONCURRENCY,
    });

    expect(peak).toBe(BATCH_UPLOAD_CONCURRENCY);
    expect(results).toEqual([2, 4, 6, 8, 10]);
  });
});

describe("upload errors", () => {
  test("prefers structured provider messages and safely handles unknown errors", () => {
    expect(
      getUploadErrorMessage({ data: { message: "Provider rate limit hit" } }),
    ).toBe("Provider rate limit hit");
    expect(getUploadErrorMessage(null)).toBe("Upload failed");
  });
});
