import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";
import type { ConfigField, ConfigSchema } from "../types";
import {
  extractBalanced,
  splitKeyValue,
  splitTopLevel,
  stripComments,
} from "./ast-utils";

/**
 * Statically parses an Astro content-collection config (`src/content/config.ts`
 * or `src/content.config.ts`) into an authoritative field map. Astro's Zod
 * schema is the source of truth — `z.array(z.string())` means the field MUST be
 * a YAML list, which is exactly the constraint that broke publishing when
 * detection had only sampled a scalar value.
 *
 * Best-effort and never throws: anything it can't recognize maps to "string"
 * and the caller's sample aggregation refines it.
 *
 * @param contentPath repo-relative content dir, used to pick the matching
 *   collection (e.g. ".../content/blog" → the `blog` collection).
 */
export function parseAstroConfig(
  source: string,
  contentPath?: string,
): ConfigSchema | null {
  const src = stripComments(source);
  const schemaBody = findCollectionSchemaBody(src, contentPath);
  if (schemaBody === null) return null;

  const schema: ConfigSchema = new Map();
  for (const segment of splitTopLevel(schemaBody)) {
    const kv = splitKeyValue(segment);
    if (!kv) continue;
    schema.set(kv.key, mapZodExpr(kv.value));
  }

  return schema.size > 0 ? schema : null;
}

/** Locates the `z.object({ ... })` body of the relevant collection's schema. */
function findCollectionSchemaBody(
  src: string,
  contentPath?: string,
): string | null {
  const target = collectionNameFromPath(contentPath);

  // Capture every `const <name> = defineCollection(` and its position.
  const defRe =
    /(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*defineCollection\s*\(/g;
  const collections: Array<{ name: string; schemaBody: string }> = [];

  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
  while ((match = defRe.exec(src)) !== null) {
    const name = match[1] ?? "";
    const openParen = src.indexOf("(", match.index + match[0].length - 1);
    if (openParen < 0) continue;
    const args = extractBalanced(src, openParen);
    if (!args) continue;

    const body = schemaObjectBody(args.inner);
    if (body !== null) collections.push({ name, schemaBody: body });
  }

  if (collections.length === 0) return null;
  if (target) {
    const matched = collections.find(
      (c) => c.name.toLowerCase() === target.toLowerCase(),
    );
    if (matched) return matched.schemaBody;
  }
  return collections[0]?.schemaBody ?? null;
}

/** Extracts the `z.object({...})` body from a defineCollection args object. */
function schemaObjectBody(defineArgs: string): string | null {
  const schemaIdx = defineArgs.search(/\bschema\s*:/);
  if (schemaIdx < 0) return null;

  // From `schema:` onward, find the first `z.object(` (handles both
  // `schema: z.object({...})` and `schema: ({ image }) => z.object({...})`).
  const after = defineArgs.slice(schemaIdx);
  const objMatch = after.search(/z\s*\.\s*object\s*\(/);
  if (objMatch < 0) return null;

  const openParen = after.indexOf("(", objMatch);
  const parenInner = extractBalanced(after, openParen);
  if (!parenInner) return null;

  // The object literal is the `{...}` inside z.object( ... ).
  const braceIdx = parenInner.inner.indexOf("{");
  if (braceIdx < 0) return null;
  const obj = extractBalanced(parenInner.inner, braceIdx);
  return obj ? obj.inner : null;
}

function collectionNameFromPath(contentPath?: string): string | null {
  if (!contentPath) return null;
  const m = contentPath.match(/content\/([^/]+)/);
  if (m?.[1]) return m[1];
  const segments = contentPath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? null;
}

/** Maps a single Zod field expression to a field type + required + options. */
function mapZodExpr(expr: string): ConfigField {
  const required =
    !/\.optional\s*\(/.test(expr) &&
    !/\.nullish\s*\(/.test(expr) &&
    !/\.nullable\s*\(/.test(expr) &&
    !/\.default\s*\(/.test(expr);

  const type = zodType(expr);
  const options = type === "select" ? extractEnumOptions(expr) : "";

  return { type, required, options };
}

function zodType(expr: string): FrontmatterFieldType {
  // Order matters: composite/wrapped forms before the bare `z.string` fallback.
  if (/z\s*\.\s*array\s*\(/.test(expr) || /\.\s*array\s*\(\s*\)/.test(expr)) {
    return "tags";
  }
  if (/z\s*\.\s*enum\s*\(/.test(expr)) return "select";
  if (/z\s*\.\s*boolean/.test(expr)) return "boolean";
  if (/z\s*\.\s*number/.test(expr)) return "number";
  if (/\.\s*datetime\s*\(/.test(expr)) return "datetime";
  if (/z\s*\.\s*(coerce\s*\.\s*)?date/.test(expr)) return "date";
  if (/\.\s*url\s*\(/.test(expr)) return "url";
  // Astro's `image()` schema helper.
  if (/(^|[^.\w])image\s*\(/.test(expr)) return "image";
  return "string";
}

function extractEnumOptions(expr: string): string {
  const enumIdx = expr.search(/z\s*\.\s*enum\s*\(/);
  if (enumIdx < 0) return "";
  const bracketIdx = expr.indexOf("[", enumIdx);
  if (bracketIdx < 0) return "";
  const arr = extractBalanced(expr, bracketIdx);
  if (!arr) return "";
  return splitTopLevel(arr.inner)
    .map((s) => s.replace(/^['"`]|['"`]$/g, "").trim())
    .filter(Boolean)
    .join(", ");
}
