import persistentTextStreaming from "@convex-dev/persistent-text-streaming/convex.config";
import workflow from "@convex-dev/workflow/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workflow);
app.use(persistentTextStreaming);
export default app;
