const ALWAYS_ARRAY_FIELDS: ReadonlySet<string> = new Set([
  "tags",
  "keywords",
  "categories",
  "topics",
  "authors",
  "aliases",
]);

const PLURAL_SCALAR_DENYLIST: ReadonlySet<string> = new Set([
  "address",
  "status",
  "synopsis",
  "rss",
  "class",
  "css",
  "canvas",
]);

const ARRAY_SCHEMA_TYPES: ReadonlySet<string> = new Set([
  "tags",
  "list",
  "multiselect",
]);

type SchemaFieldLike = { name: string; type: string };

function parseSchemaFields(
  schemaJson: string | null | undefined,
): SchemaFieldLike[] {
  if (!schemaJson) return [];
  try {
    const parsed = JSON.parse(schemaJson) as unknown;
    return Array.isArray(parsed) ? (parsed as SchemaFieldLike[]) : [];
  } catch {
    return [];
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (value === null || value === undefined) return [];
  return [String(value)];
}

export function coerceFrontmatterArrays(
  frontmatter: Record<string, unknown>,
  schemaJson?: string | null,
): Record<string, unknown> {
  const fields = parseSchemaFields(schemaJson);
  const typeByName = new Map<string, string>();
  for (const f of fields) {
    if (f && typeof f.name === "string") typeByName.set(f.name, f.type);
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      out[key] = value;
      continue;
    }

    const lowerKey = key.toLowerCase();
    const schemaType = typeByName.get(key);

    const bySchema =
      schemaType !== undefined && ARRAY_SCHEMA_TYPES.has(schemaType);
    const byName = ALWAYS_ARRAY_FIELDS.has(lowerKey);
    const byHeuristic =
      !PLURAL_SCALAR_DENYLIST.has(lowerKey) &&
      lowerKey.endsWith("s") &&
      typeof value === "string" &&
      value.includes(",");

    out[key] = bySchema || byName || byHeuristic ? toStringArray(value) : value;
  }

  return out;
}

export function normalizeSchemaArrayTypes(
  schemaJson: string | null | undefined,
): {
  json: string | null;
  changed: boolean;
} {
  if (!schemaJson) return { json: schemaJson ?? null, changed: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaJson);
  } catch {
    return { json: schemaJson, changed: false };
  }
  if (!Array.isArray(parsed)) return { json: schemaJson, changed: false };

  let changed = false;
  const next = parsed.map((field) => {
    if (!field || typeof field !== "object") return field;
    const f = field as Record<string, unknown>;
    const name = typeof f["name"] === "string" ? f["name"] : "";
    const type = typeof f["type"] === "string" ? f["type"] : "";

    const shouldBeArray = ALWAYS_ARRAY_FIELDS.has(name.toLowerCase());
    const isAlreadyArray = ARRAY_SCHEMA_TYPES.has(type);
    if (shouldBeArray && !isAlreadyArray) {
      changed = true;
      return { ...f, type: "tags" };
    }
    return field;
  });

  return changed
    ? { json: JSON.stringify(next), changed: true }
    : { json: schemaJson, changed: false };
}
