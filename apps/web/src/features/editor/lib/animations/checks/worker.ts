import { createAnimationChecker } from "@wryte/backend/_lib/animationChecker/run";
import type {
  CheckRequest,
  CheckResponse,
} from "@wryte/logic/lib/animations/checks/protocol";

const check = createAnimationChecker(() =>
  import("typescript").then((module) => module.default ?? module),
);

self.addEventListener("message", (event: MessageEvent<CheckRequest>) => {
  const { id, ...request } = event.data;
  void check(request).then((result) => {
    const response: CheckResponse = { id, result };
    self.postMessage(response);
  });
});
