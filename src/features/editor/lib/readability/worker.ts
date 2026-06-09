/// <reference lib="webworker" />

import { analyze } from "./analyze";
import type {
  AnalyzeRequestMessage,
  AnalyzeResponseMessage,
} from "./worker-protocol";

/**
 * Readability worker. Runs the pure `analyze()` off the main thread for large
 * documents. The exact same `analyze()` is used on the main thread by
 * `worker-client.ts` when a worker isn't available, so behavior is identical.
 */

const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.addEventListener(
  "message",
  (event: MessageEvent<AnalyzeRequestMessage>) => {
    const req = event.data;
    try {
      const result = analyze(req.text);
      const response: AnalyzeResponseMessage = { id: req.id, ok: true, result };
      scope.postMessage(response);
    } catch (err) {
      const response: AnalyzeResponseMessage = {
        id: req.id,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
      scope.postMessage(response);
    }
  },
);
