import { Workpool } from "@convex-dev/workpool";
import { components } from "../_generated/api";

export const importPool = new Workpool(components.githubImportPool, {
  maxParallelism: 5,
  retryActionsByDefault: true,
  defaultRetryBehavior: {
    maxAttempts: 3,
    initialBackoffMs: 1500,
    base: 2,
  },
});
