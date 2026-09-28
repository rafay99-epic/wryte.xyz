export type SchemaField = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  options: string;
  description?: string;
  hidden?: boolean;
};

export type FrontmatterContract = {
  fields: SchemaField[];
  requiredFields: string[];
  defaults: Record<string, string>;
  note: string;
};

function toSchemaField(value: unknown): SchemaField | null {
  if (typeof value !== "object" || value === null) return null;

  const read = (key: string): unknown => Reflect.get(value, key);
  const text = (key: string): string | undefined => {
    const field = read(key);
    return typeof field === "string" ? field : undefined;
  };

  const name = text("name");
  const type = text("type");
  if (name === undefined || type === undefined) return null;

  const description = text("description");
  return {
    name,
    type,
    required: read("required") === true,
    defaultValue: text("defaultValue") ?? "",
    options: text("options") ?? "",
    ...(description !== undefined ? { description } : {}),
    ...(read("hidden") === true ? { hidden: true } : {}),
  };
}

function parseFields(
  raw: string | undefined,
): { fields: SchemaField[] } | { error: string } {
  if (!raw) return { fields: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { error: "schema is not an array" };
    return {
      fields: parsed.flatMap((item) => {
        const field = toSchemaField(item);
        return field === null ? [] : [field];
      }),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export function frontmatterContract(
  raw: string | undefined,
): FrontmatterContract {
  const parsed = parseFields(raw);
  const fields = "fields" in parsed ? parsed.fields : [];

  const defaults: Record<string, string> = {};
  for (const field of fields) {
    if (field.defaultValue) {
      defaults[field.name] = field.defaultValue;
    } else if (field.type === "date") {
      defaults[field.name] = "today's date (YYYY-MM-DD)";
    } else if (field.type === "datetime") {
      defaults[field.name] = "today's date-time (ISO 8601)";
    }
  }

  const note =
    "error" in parsed
      ? `No usable schema: the stored schema failed to parse (${parsed.error}). Frontmatter is free-form for this project.`
      : fields.length === 0
        ? "No schema configured. Frontmatter is free-form for this project."
        : "Pass frontmatter as a JSON object string keyed by field name, with every required field, on wryte_documents_create and on each draft.";

  return {
    fields,
    requiredFields: fields
      .filter((f) => f.required && !f.hidden)
      .map((f) => f.name),
    defaults,
    note,
  };
}
