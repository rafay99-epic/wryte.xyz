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
  name: string;
  type: FrontmatterFieldType;
  required: boolean;
  defaultValue: string;
  options: string;
  label?: string | undefined;
  description?: string | undefined;
  placeholder?: string | undefined;
  min?: number | undefined;
  max?: number | undefined;
  group?: string | undefined;
  hidden?: boolean | undefined;
  step?: number | undefined;
};

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
