/**
 * Describes a single frontmatter field's schema for the editor UI.
 * Each field maps to a form control whose behavior depends on `type`:
 * - "string": single-line text input
 * - "text": multi-line textarea (for descriptions, excerpts, etc.)
 * - "boolean": checkbox/toggle
 * - "date": date picker
 * - "tags": comma-separated tag input that serializes to a YAML array
 * - "select": dropdown whose choices come from the `options` string
 */
export interface FrontmatterField {
  /** The YAML key name (e.g., "title", "date", "draft") */
  name: string;
  /** Determines which form control the editor renders for this field */
  type: "string" | "text" | "boolean" | "date" | "tags" | "select";
  /** Whether the field must be filled before saving */
  required: boolean;
  /** Pre-populated value for new posts (stored as string, coerced at render time) */
  defaultValue: string;
  /** Comma-separated list of allowed values — only used when type is "select" */
  options: string;
}

/**
 * Sensible defaults for a typical blog/content site.
 * Used as the initial frontmatter schema when the user creates a new site
 * and hasn't run auto-detection against an existing repo yet.
 */
export const DEFAULT_FRONTMATTER_FIELDS: FrontmatterField[] = [
  {
    name: "title",
    type: "string",
    required: true,
    defaultValue: "",
    options: "",
  },
  {
    name: "description",
    type: "text",
    required: false,
    defaultValue: "",
    options: "",
  },
  { name: "date", type: "date", required: true, defaultValue: "", options: "" },
  {
    name: "tags",
    type: "tags",
    required: false,
    defaultValue: "",
    options: "",
  },
  {
    name: "draft",
    type: "boolean",
    required: false,
    defaultValue: "true",
    options: "",
  },
];
