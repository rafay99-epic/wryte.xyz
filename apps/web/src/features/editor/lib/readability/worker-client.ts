import { analyze } from "./analyze";
import type { ReadabilityResult } from "./types";
import type { AnalyzeResponseMessage } from "./worker-protocol";

/**
 * Owns a single readability Web Worker and routes analysis onto it. Worker
 * construction can fail in SSR and some embedded webviews; when it does we set
 * `useMainThread` and run the identical `analyze()` inline. Once fallen back we
 * don't retry. Mirrors `src/lib/image-compression/worker-client.ts`.
 */

let workerSingleton: Worker | null = null;
let useMainThread = false;
let nextId = 1;
const pending = new Map<number, (r: AnalyzeResponseMessage) => void>();

function getWorker(): Worker | null {
  if (workerSingleton) return workerSingleton;
  if (useMainThread || typeof Worker === "undefined") return null;
  try {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener(
      "message",
      (event: MessageEvent<AnalyzeResponseMessage>) => {
        const handler = pending.get(event.data.id);
        if (!handler) return;
        pending.delete(event.data.id);
        handler(event.data);
      },
    );
    worker.addEventListener("error", (event) => {
      console.warn("[readability] worker error:", event.message);
      workerSingleton = null;
      useMainThread = true;
      for (const [id, handler] of pending) {
        handler({ id, ok: false, error: event.message || "Worker error" });
      }
      pending.clear();
    });
    workerSingleton = worker;
    return worker;
  } catch (err) {
    console.warn("[readability] worker init failed, using main thread:", err);
    useMainThread = true;
    return null;
  }
}

/** Analyze `text`, off the main thread when a worker is available. */
export async function analyzeAsync(text: string): Promise<ReadabilityResult> {
  const worker = getWorker();
  if (!worker) return analyze(text);

  const id = nextId++;
  return new Promise<ReadabilityResult>((resolve) => {
    pending.set(id, (res) => {
      if (res.ok) resolve(res.result);
      // On a worker-side failure, fall back to a main-thread run.
      else resolve(analyze(text));
    });
    worker.postMessage({ id, text });
  });
}
