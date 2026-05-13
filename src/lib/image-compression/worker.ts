/// <reference lib="webworker" />

import { runEncodePipeline } from "./encode-pipeline";
import type {
  EncodeRequestMessage,
  EncodeResponseMessage,
} from "./worker-protocol";

/**
 * Compression worker. Receives an `EncodeRequestMessage` with a transferred
 * `ImageBitmap`, runs the shared encode pipeline, and posts back the
 * resulting `Blob`. Worker terminates on its own; the host
 * (`worker-client.ts`) treats it as a session-lifetime singleton.
 *
 * Note on Blob transfers: `Blob` is **not** a transferable type in the
 * structured-clone spec — only `ArrayBuffer`, `MessagePort`, `ImageBitmap`,
 * `OffscreenCanvas`, and a handful of streams are. Blobs are
 * structured-cloned by reference, which is already near-zero-copy in modern
 * browsers, so we don't pass a transfer list for the response.
 *
 * The actual encode logic lives in `encode-pipeline.ts` so the main-thread
 * fallback uses the exact same code path.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.addEventListener(
  "message",
  async (event: MessageEvent<EncodeRequestMessage>) => {
    const req = event.data;
    try {
      const result = await runEncodePipeline({
        bitmap: req.bitmap,
        width: req.width,
        height: req.height,
        format: req.format,
        quality: req.quality,
        flattenWhite: req.flattenWhite,
        cornerRadius: req.cornerRadius,
      });
      const response: EncodeResponseMessage = {
        id: req.id,
        ok: true,
        blob: result.blob,
        width: result.width,
        height: result.height,
        resolvedFormat: result.resolvedFormat,
      };
      scope.postMessage(response);
    } catch (err) {
      const response: EncodeResponseMessage = {
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      scope.postMessage(response);
    } finally {
      req.bitmap.close();
    }
  },
);
