/// <reference lib="webworker" />

import { runEncodePipeline } from "./encode-pipeline";
import type {
  EncodeRequestMessage,
  EncodeResponseMessage,
} from "./worker-protocol";

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
