import yaml from "js-yaml";
import { parse as parseToml } from "smol-toml";
import type { FrontmatterFormat } from "./types";

// Leading BOM (\uFEFF) tolerated; matches a `---` … `---` YAML block.
const YAML_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n[\s\S]*)?$/;
// Hugo-style `+++` … `+++` TOML block.
const TOML_RE = /^\uFEFF?\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\s*(?:\r?\n[\s\S]*)?$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Parses a markdown/MDX file's frontmatter block, supporting both YAML (`---`)
 * and TOML (`+++`, Hugo) delimiters. Returns the parsed key/value object plus
 * the delimiter format observed, or null when there is no parseable
 * frontmatter. Never throws — malformed frontmatter yields null so a single bad
 * post can't abort detection.
 */
export function parseFrontmatter(
  raw: string,
): { data: Record<string, unknown>; format: FrontmatterFormat } | null {
  const tomlMatch = raw.match(TOML_RE);
  if (tomlMatch) {
    try {
      return { data: asRecord(parseToml(tomlMatch[1] ?? "")), format: "toml" };
    } catch {
      return null;
    }
  }

  const yamlMatch = raw.match(YAML_RE);
  if (yamlMatch) {
    try {
      return { data: asRecord(yaml.load(yamlMatch[1] ?? "")), format: "yaml" };
    } catch {
      return null;
    }
  }

  return null;
}
