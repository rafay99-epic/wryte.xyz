import assert from "node:assert/strict";
import {
  claudeCodeCommand,
  cursorInstallUrl,
  vscodeInstallUrl,
} from "@wryte/logic/lib/mcp-install";

const endpoint = "https://example.convex.site/mcp";

assert.equal(
  claudeCodeCommand(endpoint),
  "claude mcp add --transport http wryte https://example.convex.site/mcp",
);

{
  const url = new URL(cursorInstallUrl(endpoint));
  assert.equal(url.searchParams.get("name"), "wryte");
  assert.deepEqual(JSON.parse(atob(url.searchParams.get("config") ?? "")), {
    url: endpoint,
  });
}

{
  const prefix = "vscode:mcp/install?";
  const link = vscodeInstallUrl(endpoint);
  assert.ok(link.startsWith(prefix));
  assert.deepEqual(JSON.parse(decodeURIComponent(link.slice(prefix.length))), {
    name: "wryte",
    type: "http",
    url: endpoint,
  });
}
