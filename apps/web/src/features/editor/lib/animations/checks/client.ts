import type { AnimationLanguage } from "@wryte/backend/_lib/animationChecks";
import type { ActiveCheckLevel, CheckRequest, CheckResponse } from "./protocol";

type Pending = (result: CheckResponse["result"]) => void;

let worker: Worker | null = null;
let nextRequestId = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker !== null) return worker;

  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (event: MessageEvent<CheckResponse>) => {
    const { id, result } = event.data;
    const resolve = pending.get(id);
    if (resolve === undefined) return;
    pending.delete(id);
    resolve(result);
  });
  worker.addEventListener("error", (event) => {
    for (const resolve of pending.values()) {
      resolve({ kind: "failed", error: event.message });
    }
    pending.clear();
    worker?.terminate();
    worker = null;
  });
  return worker;
}

export function checkAnimationSource(
  level: ActiveCheckLevel,
  language: AnimationLanguage,
  source: string,
): Promise<CheckResponse["result"]> {
  const id = nextRequestId++;
  const request: CheckRequest = { id, level, language, source };

  return new Promise((resolve) => {
    pending.set(id, resolve);
    getWorker().postMessage(request);
  });
}
