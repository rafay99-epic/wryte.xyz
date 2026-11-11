import assert from "node:assert/strict";
import {
  parseConfigSyntax,
  usesJsonComments,
} from "../convex/_lib/configSyntax";

assert.deepEqual(parseConfigSyntax('{ "a": 1, "b": [true, null] }', "json"), {
  ok: true,
  raw: { a: 1, b: [true, null] },
});
assert.deepEqual(parseConfigSyntax("a: 1\nb:\n  - x\n  - y\n", "yaml"), {
  ok: true,
  raw: { a: 1, b: ["x", "y"] },
});
const toml = parseConfigSyntax(
  'title = "Hello"\n\n[nav]\nshowBlog = true\n',
  "toml",
);
if (!toml.ok) throw new Error(toml.message);
assert.equal(
  JSON.stringify(toml.raw),
  '{"title":"Hello","nav":{"showBlog":true}}',
);

assert.deepEqual(parseConfigSyntax('{\n  "a": 1,\n  "b": }\n', "json"), {
  ok: false,
  message: "Expected a value",
  line: 3,
});

const commented = '{\n  // build\n  "target": "ES2022",\n}\n';
assert.deepEqual(parseConfigSyntax(commented, "json"), {
  ok: false,
  message: "Comments are not allowed in JSON",
  line: 2,
});
assert.deepEqual(parseConfigSyntax(commented, "json", { jsonComments: true }), {
  ok: true,
  raw: { target: "ES2022" },
});

assert.equal(usesJsonComments(commented), true);
assert.equal(usesJsonComments('{ "a": }'), false);
assert.equal(usesJsonComments('{ "a": 1 }'), false);

assert.deepEqual(parseConfigSyntax("a: 1\n---\nb: 2\n", "yaml"), {
  ok: false,
  message: "Files with more than one YAML document can't be edited here",
  line: 2,
});

const brokenYaml = parseConfigSyntax("a: [1", "yaml");
assert.equal(brokenYaml.ok, false);
const brokenToml = parseConfigSyntax("a = ", "toml");
assert.equal(brokenToml.ok, false);

console.info("config-syntax: all assertions passed");
