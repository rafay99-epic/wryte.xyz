import yaml from "js-yaml";
import { inferFieldType } from "../infer";
import type { ConfigSchema } from "../types";

export function parseJekyllConfig(source: string): ConfigSchema | null {
  let data: unknown;
  try {
    data = yaml.load(source);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;

  const defaults = (data as Record<string, unknown>)["defaults"];
  if (!Array.isArray(defaults)) return null;

  const schema: ConfigSchema = new Map();
  for (const entry of defaults) {
    if (!entry || typeof entry !== "object") continue;
    const values = (entry as Record<string, unknown>)["values"];
    if (!values || typeof values !== "object" || Array.isArray(values))
      continue;

    for (const [key, value] of Object.entries(
      values as Record<string, unknown>,
    )) {
      if (schema.has(key)) continue;
      schema.set(key, {
        type: inferFieldType(value, key),
        required: false,
        options: "",
      });
    }
  }

  return schema.size > 0 ? schema : null;
}
