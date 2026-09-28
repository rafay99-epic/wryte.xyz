import assert from "node:assert/strict";
import ts from "typescript6";
import { createAnimationChecker } from "../convex/_lib/animationChecker/run";

const check = createAnimationChecker(async () => ts);

async function rules(language: "tsx" | "jsx", source: string) {
  const result = await check({ level: "contract", language, source });
  assert.equal(result.kind, "checked");
  return result.kind === "checked" ? result.diagnostics.map((d) => d.rule) : [];
}

assert.deepEqual(
  await rules(
    "tsx",
    `export default function A() {
  return <svg role="img" aria-label="dot"><circle r={2} /></svg>;
}`,
  ),
  [],
);

assert.deepEqual(
  await rules(
    "tsx",
    `const w = window.innerWidth;
export default function A(p: any) { return <svg>{w}{p}</svg>; }`,
  ),
  ["no-module-scope-dom", "no-explicit-any", "svg-needs-accessible-name"],
);

assert.ok(
  (
    await rules(
      "jsx",
      `export default function A(p: { n: number }) { return <b>{p.n}</b>; }`,
    )
  ).includes("no-typescript-in-javascript"),
);

console.info("animation-checker: all assertions passed");
