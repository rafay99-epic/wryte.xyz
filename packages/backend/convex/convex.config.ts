import persistentTextStreaming from "@convex-dev/persistent-text-streaming/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workflow);
app.use(resend);
app.use(persistentTextStreaming);
app.use(rateLimiter);
app.use(workpool, { name: "githubImportPool" });
export default app;
