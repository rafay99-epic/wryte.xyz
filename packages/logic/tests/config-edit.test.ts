import { describe, expect, test } from "bun:test";
import { diffLines } from "../src/lib/config/diff";
import { applyConfigEdit } from "../src/lib/config/edit";
import { parseConfig, usesJsonComments } from "../src/lib/config/parse";
import { listConfigFolders } from "../src/lib/config/tree";
import { inlineColumns, OpaqueValue } from "../src/lib/config/value";

const JSON_TEXT = `{
\t"10": "first",
\t"stack": [
\t\t{ "name": "React", "color": "#7aa2f7" },
\t\t{ "name": "Django", "color": "#9ece6a" }
\t],
\t"flags": { "showBlog": true }
}
`;

const YAML_TEXT = `# site settings
title: Hello # shown in the header
stack:
  - name: React # frontend
  - name: Django
flags:
  showBlog: true
`;

const TOML_TEXT = `# site settings
title = "Hello" # shown in the header
launched = 2024-01-02

[flags]
showBlog = true

[[stack]]
name = "React"

[[stack]]
name = "Django"
`;

describe("applyConfigEdit", () => {
  test("json: a scalar edit touches only that value", () => {
    const next = applyConfigEdit(JSON_TEXT, "json", {
      kind: "set",
      path: ["flags", "showBlog"],
      value: false,
    });
    expect(next).toBe(
      JSON_TEXT.replace('"showBlog": true', '"showBlog": false'),
    );
  });

  test("json: insert, move and remove keep key order and tab indent", () => {
    const inserted = applyConfigEdit(JSON_TEXT, "json", {
      kind: "insert",
      path: ["stack"],
      index: 2,
      value: { name: "Convex", color: "" },
    });
    const moved = applyConfigEdit(inserted, "json", {
      kind: "move",
      path: ["stack"],
      from: 2,
      to: 0,
    });
    const removed = applyConfigEdit(moved, "json", {
      kind: "remove",
      path: ["stack", 1],
    });
    const parsed = parseConfig(removed, "json");
    expect(parsed).toEqual({
      ok: true,
      value: {
        "10": "first",
        stack: [
          { name: "Convex", color: "" },
          { name: "Django", color: "#9ece6a" },
        ],
        flags: { showBlog: true },
      },
    });
    expect(removed.indexOf('"10"')).toBeLessThan(removed.indexOf('"stack"'));
    expect(removed).toContain('\n\t\t{\n\t\t\t"name": "Convex"');
  });

  test("yaml: edits keep comments", () => {
    const set = applyConfigEdit(YAML_TEXT, "yaml", {
      kind: "set",
      path: ["stack", 1, "name"],
      value: "Convex",
    });
    expect(set).toBe(YAML_TEXT.replace("Django", "Convex"));

    const moved = applyConfigEdit(YAML_TEXT, "yaml", {
      kind: "move",
      path: ["stack"],
      from: 0,
      to: 1,
    });
    expect(moved).toContain("# site settings");
    expect(moved).toContain("- name: React # frontend");
    expect(moved.indexOf("Django")).toBeLessThan(moved.indexOf("React"));
  });

  test("yaml: a scalar edit leaves every other byte alone", () => {
    const source =
      "---\r\ntitle: 'Hello'\r\nlist:\r\n- one\r\n- two\r\ntags: [a, b]\r\ncount: 3\r\n";
    const title = applyConfigEdit(source, "yaml", {
      kind: "set",
      path: ["title"],
      value: "it's: new",
    });
    expect(title).toBe(source.replace("'Hello'", "'it''s: new'"));

    const count = applyConfigEdit(source, "yaml", {
      kind: "set",
      path: ["count"],
      value: 4,
    });
    expect(count).toBe(source.replace("count: 3", "count: 4"));
  });

  test("yaml: list edits keep line endings, list indent and flow style", () => {
    const source = "title: x\r\nlist:\r\n- one\r\n- two\r\ntags: [a, b]\r\n";
    const next = applyConfigEdit(source, "yaml", {
      kind: "insert",
      path: ["list"],
      index: 2,
      value: "three",
    });
    expect(next).toBe(source.replace("- two\r\n", "- two\r\n- three\r\n"));
  });

  test("yaml: list edits take the indent from keys, not comments or block text", () => {
    const source =
      "# top\ncode: |-\n      deep text\nmeta:\n    # note\n  keep: true\nlist:\n  - a\n";
    const next = applyConfigEdit(source, "yaml", {
      kind: "insert",
      path: ["list"],
      index: 1,
      value: "b",
    });
    expect(next).toBe(`${source}  - b\n`);
  });

  test("yaml: a moved or removed item takes its own comment with it", () => {
    const source =
      "stack:\n    - name: React # frontend\n    # backend\n    - name: Django\nflags:\n  on: true\n";
    const moved = applyConfigEdit(source, "yaml", {
      kind: "move",
      path: ["stack"],
      from: 1,
      to: 0,
    });
    expect(moved).toBe(
      "stack:\n    # backend\n    - name: Django\n    - name: React # frontend\nflags:\n  on: true\n",
    );
    const removed = applyConfigEdit(source, "yaml", {
      kind: "remove",
      path: ["stack", 1],
    });
    expect(removed).toBe(
      "stack:\n    - name: React # frontend\nflags:\n  on: true\n",
    );
  });

  test("yaml: a multi-document file is refused, never truncated", () => {
    const source = "a: 1\nlist: [x, y]\n---\nb: 2\n";
    expect(parseConfig(source, "yaml")).toEqual({
      ok: false,
      message: "Files with more than one YAML document can't be edited here",
      line: 3,
    });
    expect(() =>
      applyConfigEdit(source, "yaml", { kind: "set", path: ["a"], value: 5 }),
    ).toThrow();
  });

  test("json: indent comes from the first property, not a comment", () => {
    const source = '{\n      // note\n  "list": [\n    1\n  ]\n}\n';
    const next = applyConfigEdit(source, "json", {
      kind: "insert",
      path: ["list"],
      index: 1,
      value: 2,
    });
    expect(next).toBe(source.replace("    1\n", "    1,\n    2\n"));
  });

  test("moving a missing item fails in every format", () => {
    const move = { kind: "move", path: ["stack"], from: 5, to: 0 } as const;
    expect(() => applyConfigEdit(JSON_TEXT, "json", move)).toThrow();
    expect(() => applyConfigEdit(YAML_TEXT, "yaml", move)).toThrow();
    expect(() => applyConfigEdit(TOML_TEXT, "toml", move)).toThrow();
  });

  test("toml: edits keep comments and dates", () => {
    const next = applyConfigEdit(TOML_TEXT, "toml", {
      kind: "insert",
      path: ["stack"],
      index: 2,
      value: { name: "Convex" },
    });
    expect(next.startsWith(TOML_TEXT)).toBe(true);
    expect(next).toContain('name = "Convex"');

    const set = applyConfigEdit(TOML_TEXT, "toml", {
      kind: "set",
      path: ["flags", "showBlog"],
      value: false,
    });
    expect(set).toBe(TOML_TEXT.replace("showBlog = true", "showBlog = false"));
  });
});

describe("parseConfig", () => {
  test("reports the line of a json syntax error", () => {
    const result = parseConfig('{\n  "a": 1,\n  "b": }\n', "json");
    expect(result).toEqual({
      ok: false,
      message: "Expected a value",
      line: 3,
    });
  });

  test("rejects comments in json", () => {
    expect(parseConfig('{ "a": 1 } // note', "json").ok).toBe(false);
  });

  test("accepts json comments only when asked", () => {
    const source = '{\n  // build\n  "target": "ES2022",\n}\n';
    expect(usesJsonComments(source)).toBe(true);
    expect(usesJsonComments('{ "a": }')).toBe(false);
    expect(parseConfig(source, "json", { jsonComments: true })).toEqual({
      ok: true,
      value: { target: "ES2022" },
    });
  });

  test("reports yaml and toml errors", () => {
    expect(parseConfig("a: [1", "yaml").ok).toBe(false);
    expect(parseConfig("a = ", "toml").ok).toBe(false);
  });

  test("keeps toml dates as read-only values", () => {
    const result = parseConfig(TOML_TEXT, "toml");
    if (!result.ok) throw new Error(result.message);
    expect(result.value).toMatchObject({
      title: "Hello",
      launched: expect.any(OpaqueValue),
    });
  });
});

test("listConfigFolders counts files per folder and subtree", () => {
  const folders = listConfigFolders([
    { path: "src/config/site/info.json", size: 1 },
    { path: "src/config/flags/flags.json", size: 1 },
    { path: "src/config/theme.yaml", size: 1 },
    { path: "data/nav.toml", size: 1 },
  ]);
  expect(folders.map((f) => [f.path, f.fileCount, f.totalCount])).toEqual([
    ["data", 1, 1],
    ["src", 0, 3],
    ["src/config", 1, 3],
    ["src/config/flags", 1, 1],
    ["src/config/site", 1, 1],
  ]);
});

describe("diffLines", () => {
  const base = ["a", "b", "c", "d", "e", "f", "g", "h"].join("\n");

  test("returns nothing for identical text", () => {
    expect(diffLines(base, base)).toEqual([]);
  });

  test("groups a changed line with its context and numbers both sides", () => {
    const hunks = diffLines(base, base.replace("d", "D"), 1);
    expect(hunks).toEqual([
      {
        newStart: 4,
        lines: [
          { kind: "context", text: "c", oldLine: 3, newLine: 3 },
          { kind: "remove", text: "d", oldLine: 4, newLine: null },
          { kind: "add", text: "D", oldLine: null, newLine: 4 },
          { kind: "context", text: "e", oldLine: 5, newLine: 5 },
        ],
      },
    ]);
  });

  test("keeps distant edits in separate hunks and handles pure inserts", () => {
    const next = ["a", "new", "b", "c", "d", "e", "f", "g", "H"].join("\n");
    const hunks = diffLines(base, next, 1);
    expect(hunks.map((hunk) => hunk.newStart)).toEqual([2, 9]);
    expect(hunks[0]?.lines.map((line) => line.kind)).toEqual([
      "context",
      "add",
      "context",
    ]);
  });
});

test("inlineColumns picks lists of small flat objects", () => {
  expect(
    inlineColumns([
      { label: "Years", value: "4+" },
      { label: "Tech", note: 1 },
    ]),
  ).toEqual(["label", "value", "note"]);
  expect(inlineColumns([{ a: 1, b: 2, c: 3, d: 4, e: 5 }])).toBeNull();
  expect(inlineColumns([{ a: [1] }])).toBeNull();
  expect(inlineColumns(["x"])).toBeNull();
});
