import assert from "node:assert/strict";
import { currentScopes } from "../convex/mcp/scopes";

assert.deepEqual(currentScopes(undefined), [
  "wryte:read",
  "wryte:write",
  "wryte:notes",
]);
assert.deepEqual(
  currentScopes(["wryte:publish", "wryte:trash", "wryte:read"]),
  ["wryte:read", "wryte:trash"],
);
assert.deepEqual(currentScopes(["wryte:notes", "wryte:read"]), [
  "wryte:read",
  "wryte:notes",
]);
assert.deepEqual(currentScopes([]), []);

console.info("mcp-scopes: all assertions passed");
