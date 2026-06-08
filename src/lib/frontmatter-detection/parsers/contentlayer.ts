import type { FrontmatterFieldType } from "@/types/frontmatter";
import type { ConfigField, ConfigSchema } from "../types";
import {
  extractBalanced,
  splitKeyValue,
  splitTopLevel,
  stripComments,
} from "./ast-utils";

/**
 * Parses a Contentlayer config (`contentlayer.config.ts`) — the common
 * frontmatter source for Next.js content sites. Its `fields` map is explicitly
 * typed (`{ type: 'list', required: true }`), which makes it the most reliable
 * config to read.
 */
export function parseContentlayerConfig(source: string): ConfigSchema | null {
  const src = stripComments(source);
  const fieldsBody = findFieldsBody(src);
  if (fieldsBody === null) return null;

  const schema: ConfigSchema = new Map();
  for (const segment of splitTopLevel(fieldsBody)) {
    const kv = splitKeyValue(segment);
    if (!kv) continue;
    schema.set(kv.key, mapFieldDef(kv.value));
  }

  return schema.size > 0 ? schema : null;
}

/** Finds the `fields: { ... }` object body of the first document type. */
function findFieldsBody(src: string): string | null {
  const fieldsIdx = src.search(/\bfields\s*:/);
  if (fieldsIdx < 0) return null;
  const braceIdx = src.indexOf("{", fieldsIdx);
  if (braceIdx < 0) return null;
  const obj = extractBalanced(src, braceIdx);
  return obj ? obj.inner : null;
}

/** Maps a Contentlayer field definition object to our field type. */
function mapFieldDef(def: string): ConfigField {
  const typeMatch = def.match(/\btype\s*:\s*['"`]([a-zA-Z]+)['"`]/);
  const clType = typeMatch?.[1]?.toLowerCase() ?? "string";
  const required = /\brequired\s*:\s*true\b/.test(def);
  const type = mapContentlayerType(clType);
  const options = type === "select" ? extractOptions(def) : "";

  return { type, required, options };
}

function mapContentlayerType(clType: string): FrontmatterFieldType {
  switch (clType) {
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "date":
      return "date";
    case "list":
      return "tags";
    case "enum":
      return "select";
    case "json":
    case "nested":
      return "json";
    case "markdown":
    case "mdx":
      return "text";
    default:
      return "string";
  }
}

function extractOptions(def: string): string {
  const optIdx = def.search(/\boptions\s*:/);
  if (optIdx < 0) return "";
  const bracketIdx = def.indexOf("[", optIdx);
  if (bracketIdx < 0) return "";
  const arr = extractBalanced(def, bracketIdx);
  if (!arr) return "";
  return splitTopLevel(arr.inner)
    .map((s) => s.replace(/^['"`]|['"`]$/g, "").trim())
    .filter(Boolean)
    .join(", ");
}
