import yaml from "js-yaml";
import { parse as parseToml } from "smol-toml";
import type { FrontmatterFormat } from "./types";

const YAML_RE = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n[\s\S]*)?$/;
const TOML_RE = /^\uFEFF?\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+\s*(?:\r?\n[\s\S]*)?$/;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

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
