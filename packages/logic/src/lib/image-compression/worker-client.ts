import { runEncodePipeline } from "./encode-pipeline";
import type {
  EncodeRequestMessage,
  EncodeResponseMessage,
} from "./worker-protocol";

/**
 * Thin client that owns a single Web Worker and serialises encode requests
 * onto it. Bitmaps are transferred (zero-copy), so callers MUST NOT use the
 * bitmap afterwards.
 *
 * Worker construction can fail in some embedded webviews and during SSR.
 * When that happens we set `useMainThread` and route every subsequent call
 * through `runEncodePipeline` on the main thread — same code path, just
 * blocking. Once we've fallen back we don't retry the worker; if it failed
 * once, it will keep failing.
 */

let workerSingleton: Worker | null = null;
let useMainThread = false;
let nextId = 1;
const pending = new Map<number, (r: EncodeResponseMessage) => void>();

function getWorker(): Worker | null {
  if (workerSingleton) return workerSingleton;
  if (useMainThread || typeof Worker === "undefined") return null;
  try {
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener(
      "message",
      (event: MessageEvent<EncodeResponseMessage>) => {
        const handler = pending.get(event.data.id);
        if (!handler) return;
        pending.delete(event.data.id);
        handler(event.data);
      },
    );
    worker.addEventListener("error", (event) => {
      console.warn("[image-compression] worker error:", event.message);
      workerSingleton = null;
      useMainThread = true;
      for (const [id, handler] of pending) {
        handler({
          id,
          ok: false,
          error: event.message || "Worker error",
        });
      }
      pending.clear();
    });
    workerSingleton = worker;
    return worker;
  } catch (err) {
    console.warn(
      "[image-compression] worker init failed, using main thread:",
      err,
    );
    useMainThread = true;
    return null;
  }
}

export async function encodeInWorker(
  payload: Omit<EncodeRequestMessage, "id">,
): Promise<EncodeResponseMessage> {
  const id = nextId++;
  const worker = getWorker();
  if (!worker) {
    return runOnMainThread(id, payload);
  }
  return new Promise((resolve) => {
    pending.set(id, resolve);
    const message: EncodeRequestMessage = { ...payload, id };
    worker.postMessage(message, [message.bitmap]);
  });
}

async function runOnMainThread(
  id: number,
  payload: Omit<EncodeRequestMessage, "id">,
): Promise<EncodeResponseMessage> {
  try {
    const result = await runEncodePipeline(payload);
    return {
      id,
      ok: true,
      blob: result.blob,
      width: result.width,
      height: result.height,
      resolvedFormat: result.resolvedFormat,
    };
  } catch (err) {
    return {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    payload.bitmap.close();
  }
}
