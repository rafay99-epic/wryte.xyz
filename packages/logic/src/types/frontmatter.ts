/**
 * Describes a single frontmatter field's schema for the editor UI.
 * Each field maps to a form control whose behavior depends on `type`:
 *
 * **Text types:**
 * - "string": single-line text input
 * - "text": multi-line textarea (for descriptions, excerpts, etc.)
 * - "url": URL input with validation
 * - "image": image path/URL input (can reference media library)
 * - "slug": auto-generated slug field (usually read-only)
 *
 * **Numeric types:**
 * - "number": numeric input with optional min/max
 *
 * **Date types:**
 * - "date": date-only picker (YYYY-MM-DD)
 * - "datetime": full date-time picker (ISO 8601)
 *
 * **Boolean types:**
 * - "boolean": checkbox/toggle
 *
 * **Collection types:**
 * - "tags": comma-separated tag input that serializes to a YAML array
 * - "list": ordered list of strings
 * - "select": single-choice dropdown
 * - "multiselect": multi-choice dropdown (serializes to YAML array)
 *
 * **Special types:**
 * - "color": hex color picker
 * - "json": raw JSON editor for complex nested values
 */
export type FrontmatterFieldType =
  | "string"
  | "text"
  | "url"
  | "image"
  | "slug"
  | "number"
  | "date"
  | "datetime"
  | "boolean"
  | "tags"
  | "list"
  | "select"
  | "multiselect"
  | "color"
  | "json";

/** All available field types with display labels and descriptions. */
export const FIELD_TYPE_OPTIONS: {
  value: FrontmatterFieldType;
  label: string;
  description: string;
}[] = [
  { value: "string", label: "String", description: "Single-line text" },
  { value: "text", label: "Text", description: "Multi-line textarea" },
  { value: "url", label: "URL", description: "URL with validation" },
  { value: "image", label: "Image", description: "Image path or URL" },
  { value: "slug", label: "Slug", description: "URL-safe identifier" },
  { value: "number", label: "Number", description: "Numeric value" },
  { value: "date", label: "Date", description: "Date (YYYY-MM-DD)" },
  {
    value: "datetime",
    label: "DateTime",
    description: "Full date and time",
  },
  { value: "boolean", label: "Boolean", description: "True/false toggle" },
  { value: "tags", label: "Tags", description: "Comma-separated tags" },
  { value: "list", label: "List", description: "Array of strings" },
  {
    value: "select",
    label: "Select",
    description: "Single choice dropdown",
  },
  {
    value: "multiselect",
    label: "Multi-Select",
    description: "Multiple choice",
  },
  { value: "color", label: "Color", description: "Hex color picker" },
  { value: "json", label: "JSON", description: "Raw JSON value" },
];

export type FrontmatterField = {
  /** The YAML key name (e.g., "title", "date", "draft") */
  name: string;
  /** Determines which form control the editor renders for this field */
  type: FrontmatterFieldType;
  /** Whether the field must be filled before saving */
  required: boolean;
  /** Pre-populated value for new posts (stored as string, coerced at render time) */
  defaultValue: string;
  /** Comma-separated list of allowed values — used for "select" and "multiselect" */
  options: string;
  /** Human-readable label shown in the editor (falls back to name if empty) */
  label?: string | undefined;
  /** Help text shown below the field */
  description?: string | undefined;
  /** Placeholder text for the input */
  placeholder?: string | undefined;
  /** Minimum value (for number type) or minimum length (for string/text) */
  min?: number | undefined;
  /** Maximum value (for number type) or maximum length (for string/text) */
  max?: number | undefined;
  /** Group/section name for organizing fields visually */
  group?: string | undefined;
  /** Whether this field should be hidden from the editor UI */
  hidden?: boolean | undefined;
  /** Step increment for number fields (e.g., 1 for integers, 0.1 for decimals) */
  step?: number | undefined;
};

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
