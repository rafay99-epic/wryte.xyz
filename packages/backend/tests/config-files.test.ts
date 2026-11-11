import assert from "node:assert/strict";
import {
  configFormatFromPath,
  isBrowsableConfigPath,
  normalizeConfigPath,
  requireConfigFilePath,
} from "../convex/_lib/configFiles";

assert.equal(configFormatFromPath("src/config/site.json"), "json");
assert.equal(configFormatFromPath("data/nav.YML"), "yaml");
assert.equal(configFormatFromPath("data/site.toml"), "toml");
assert.equal(configFormatFromPath("data/readme.md"), null);
assert.equal(configFormatFromPath("data/json"), null);

assert.equal(normalizeConfigPath(" /src\\config/ "), "src/config");

assert.equal(isBrowsableConfigPath("src/config"), true);
for (const path of [
  "..",
  "src/../secrets",
  ".github",
  "node_modules/pkg",
  "src/Node_Modules/pkg",
  "src/ config",
  "src /config",
  "src/config\t",
]) {
  assert.equal(isBrowsableConfigPath(path), false, path);
}

assert.equal(requireConfigFilePath("src/config", "src/config/a.json"), "json");
assert.equal(
  requireConfigFilePath("/src/config/", "src/config/deep/b.yaml"),
  "yaml",
);
assert.equal(
  requireConfigFilePath("src/config", "src/config/my site.json"),
  "json",
);

const rejected: [string | undefined, string][] = [
  [undefined, "src/config/a.json"],
  ["", "src/config/a.json"],
  ["src/config", "src/config-other/a.json"],
  ["src/config", "src/config/../../.env.json"],
  ["src/config", "src/config/.hidden/a.json"],
  ["src/config", "src/config/node_modules/a.json"],
  ["src/config", "src/config//a.json"],
  ["src/config", "/src/config/a.json"],
  ["src/config", "src/config/a.md"],
  ["src/config", "src/config"],
  ["src/config", "package.json"],
  ["src/config", "src/config/ a.json"],
  ["src/config", "src/config/a.json "],
  ["src/config", "src/config/sub /a.json"],
  ["src/config", "src/config\\a.json"],
  ["src/config", "src/config/sub\\a.json"],
];
for (const [root, path] of rejected) {
  assert.throws(
    () => requireConfigFilePath(root, path),
    `${String(root)} ${path}`,
  );
}

console.info("config-files: all assertions passed");
