/**
 * Publish-time frontmatter normalization shared across the publish paths
 * (`publishToGithub` and `bulkPublish` in `convex/integrations/github.ts`).
 *
 * THE ARRAY GUARD
 * ---------------
 * Several frontmatter keys are list-valued across every static-site framework
 * we target (Astro, Hugo, Jekyll, Next, …). If such a value reaches
 * serialization as a *scalar* — because the project's detected schema typed it
 * as `string`, or the author entered a single comma-less value — frameworks
 * with typed content collections reject the build. Astro's
 * `z.array(z.string())` is the canonical example: `tags: "a"` fails, `tags: [a]`
 * passes.
 *
 * This module guarantees those keys always serialize as arrays. It is pure and
 * in-memory, so it adds no I/O to the publish hot path (safe at 1000+
 * concurrent publishes).
 *
 * NOTE: the registry below mirrors the detection-side one in
 * `src/lib/frontmatter-detection/registry.ts`. The two deliberately live apart
 * because Convex cannot import from `src/`. Keep them in sync — same precedent
 * as `findPubDateField` (duplicated between this folder and
 * `src/lib/build-initial-frontmatter.ts`).
 */

/**
 * High-confidence list-valued keys. Only names that are array-valued in
 * essentially every framework belong here. Ambiguous singulars (`author`,
 * `category`, `series`) are intentionally excluded — schema detection types
 * those from the repo, and forcing them to arrays would corrupt sites that use
 * them as scalars.
 */
const ALWAYS_ARRAY_FIELDS: ReadonlySet<string> = new Set([
  "tags",
  "keywords",
  "categories",
  "topics",
  "authors",
  "aliases",
]);

/**
 * Plural-looking keys that are nonetheless scalar. Excluded from the
 * "plural name + comma" heuristic so we never split a real string like
 * `address: "1, Main St"`.
 */
const PLURAL_SCALAR_DENYLIST: ReadonlySet<string> = new Set([
  "address",
  "status",
  "synopsis",
  "rss",
  "class",
  "css",
  "canvas",
]);

/** Schema field types from the editor that always serialize as arrays. */
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

/** Normalizes any scalar/array value into a clean string array. */
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

/**
 * Returns a copy of `frontmatter` in which every key that *should* be a list is
 * a list. Insertion order is preserved. Decision order per key:
 *   1. already an array               → keep
 *   2. schema type is tags/list/multi → arrayify (overrides a wrong scalar)
 *   3. name in ALWAYS_ARRAY_FIELDS    → arrayify (the bug-fixing case)
 *   4. plural name + comma in value   → arrayify (heuristic, denylist-guarded)
 *   5. otherwise                      → keep
 */
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

/**
 * Repairs a stored `frontmatterSchema` JSON string by flipping any
 * high-confidence list field (tags/keywords/…) that was mistyped as a scalar
 * over to the "tags" (array) type. Used by the one-time backfill migration so
 * EXISTING projects — created before framework-aware detection — get the same
 * correct schema new projects get, without re-hitting GitHub.
 *
 * Only the field `type` is touched; every other property (required,
 * defaultValue, options, label, …) is preserved. Returns the original string
 * unchanged when nothing needed fixing, plus a `changed` flag so the caller can
 * skip the write.
 */
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
