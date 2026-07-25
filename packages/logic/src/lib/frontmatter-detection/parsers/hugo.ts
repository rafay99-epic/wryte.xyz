import yaml from "js-yaml";
import { parse as parseToml } from "smol-toml";
import { typeFromFieldName } from "../registry";
import type { ConfigField, ConfigFile, ConfigSchema } from "../types";

/**
 * Parses Hugo configuration into a field map. Hugo has no single typed schema,
 * so we combine two signals:
 *   1. `archetypes/default.md` — the template applied to new posts; its
 *      frontmatter keys (and literal values like `tags = []`) reveal the shape.
 *   2. the site config's `[taxonomies]` — every taxonomy is a list field in
 *      frontmatter (the canonical Hugo `tags`/`categories`).
 *
 * Hugo declares no required-ness, so all fields are optional here; sample
 * presence (in the merge step) decides required-ness instead.
 */
export function parseHugoConfig(files: ConfigFile[]): ConfigSchema | null {
  const schema: ConfigSchema = new Map();

  const archetype = files.find((f) => f.path.includes("archetypes"));
  if (archetype) {
    for (const { name, isArray } of parseArchetypeFields(archetype.content)) {
      schema.set(name, {
        type: isArray
          ? "tags"
          : (typeFromFieldName(name.toLowerCase()) ?? "string"),
        required: false,
        options: "",
      });
    }
  }

  const configFile = files.find((f) => !f.path.includes("archetypes"));
  if (configFile) {
    for (const taxonomy of readTaxonomies(configFile)) {
      // Taxonomies are always list-valued in frontmatter; let them win over a
      // scalar guess from the archetype.
      schema.set(taxonomy, arrayField());
    }
  }

  return schema.size > 0 ? schema : null;
}

const arrayField = (): ConfigField => ({
  type: "tags",
  required: false,
  options: "",
});

/**
 * Extracts field names (and array hints) from a Hugo archetype's frontmatter
 * block WITHOUT a strict parser. Archetypes routinely contain Go template
 * expressions (`{{ .Date }}`, `{{ replace .Name … }}`) that are invalid
 * TOML/YAML, so a strict parse throws and loses every field. We only need the
 * keys and whether each looks list-valued, so a tolerant line scan is both
 * sufficient and robust to template syntax.
 */
function parseArchetypeFields(
  content: string,
): Array<{ name: string; isArray: boolean }> {
  const tomlBlock = content.match(/^\uFEFF?\+\+\+\r?\n([\s\S]*?)\r?\n\+\+\+/);
  const yamlBlock = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/);
  const isToml = Boolean(tomlBlock);
  const body = tomlBlock?.[1] ?? yamlBlock?.[1];
  if (!body) return [];

  const separator = isToml ? "=" : ":";
  const lines = body.split("\n");
  const fields: Array<{ name: string; isArray: boolean }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Skip blanks, indented continuation lines, and TOML [tables].
    if (
      line.trim() === "" ||
      /^\s/.test(line) ||
      line.trimStart().startsWith("[")
    ) {
      continue;
    }
    const sepIdx = line.indexOf(separator);
    if (sepIdx <= 0) continue;
    const name = line.slice(0, sepIdx).trim();
    if (!/^[A-Za-z0-9_-]+$/.test(name)) continue;

    const rawValue = line.slice(sepIdx + 1).trim();
    let isArray = rawValue.startsWith("[");
    // YAML block sequence: `key:` then a `- item` line beneath it.
    if (!isToml && rawValue === "" && /^\s*-\s/.test(lines[i + 1] ?? "")) {
      isArray = true;
    }
    fields.push({ name, isArray });
  }

  return fields;
}

/**
 * Returns the plural taxonomy names declared in a Hugo config (the frontmatter
 * keys). Falls back to Hugo's built-in `tags` + `categories` when the config
 * parses but declares no explicit `[taxonomies]` table.
 */
function readTaxonomies(file: ConfigFile): string[] {
  const data = parseConfigData(file);
  if (!data) return [];

  const taxonomies = data["taxonomies"];
  if (
    taxonomies &&
    typeof taxonomies === "object" &&
    !Array.isArray(taxonomies)
  ) {
    const values = Object.values(taxonomies as Record<string, unknown>)
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length > 0) return values;
  }

  // Hugo's defaults when no taxonomies are configured.
  return ["tags", "categories"];
}

function parseConfigData(file: ConfigFile): Record<string, unknown> | null {
  try {
    if (/\.(ya?ml)$/i.test(file.path)) {
      const data = yaml.load(file.content);
      return data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : null;
    }
    const data = parseToml(file.content);
    return data && typeof data === "object"
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
