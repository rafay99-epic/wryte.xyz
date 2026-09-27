import type { FrontmatterFieldType } from "@wryte/logic/types/frontmatter";
import type { ConfigField, ConfigSchema } from "../types";
import {
  extractBalanced,
  splitKeyValue,
  splitTopLevel,
  stripComments,
} from "./ast-utils";

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

function findCollectionSchemaBody(
  src: string,
  contentPath?: string,
): string | null {
  const target = collectionNameFromPath(contentPath);

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

function schemaObjectBody(defineArgs: string): string | null {
  const schemaIdx = defineArgs.search(/\bschema\s*:/);
  if (schemaIdx < 0) return null;

  const after = defineArgs.slice(schemaIdx);
  const objMatch = after.search(/z\s*\.\s*object\s*\(/);
  if (objMatch < 0) return null;

  const openParen = after.indexOf("(", objMatch);
  const parenInner = extractBalanced(after, openParen);
  if (!parenInner) return null;

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
  if (/z\s*\.\s*array\s*\(/.test(expr) || /\.\s*array\s*\(\s*\)/.test(expr)) {
    return "tags";
  }
  if (/z\s*\.\s*enum\s*\(/.test(expr)) return "select";
  if (/z\s*\.\s*boolean/.test(expr)) return "boolean";
  if (/z\s*\.\s*number/.test(expr)) return "number";
  if (/\.\s*datetime\s*\(/.test(expr)) return "datetime";
  if (/z\s*\.\s*(coerce\s*\.\s*)?date/.test(expr)) return "date";
  if (/\.\s*url\s*\(/.test(expr)) return "url";
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
