/**
 * Pure, offline frontmatter validation used by the editor to give authors
 * instant pre-publish feedback — instead of discovering a problem minutes later
 * when the GitHub build fails. It checks a post's current frontmatter values
 * against the project's detected schema (which mirrors the framework's real
 * constraints, e.g. Astro's Zod types).
 *
 * Synchronous and dependency-free, so it can run on every keystroke.
 */

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  /** The field's YAML key. */
  field: string;
  /** Human label (falls back to the key). */
  label: string;
  message: string;
  severity: ValidationSeverity;
};

/** Minimal field shape the validator needs — a subset of FrontmatterField. */
export type ValidatableField = {
  name: string;
  type: string;
  required?: boolean | undefined;
  options?: string | undefined;
  label?: string | undefined;
};

type FieldValue = string | boolean | undefined;

function splitOptions(options: string | undefined): string[] {
  if (!options) return [];
  return options
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function isEmpty(value: FieldValue): boolean {
  return value === undefined || value === "" || value === null;
}

/**
 * Validates a flat values map (the shape the visual editor holds — strings and
 * booleans, with list fields stored as comma-separated strings) against the
 * field schema. Returns issues ordered by the schema's field order.
 */
export function validateFrontmatter(
  values: Record<string, FieldValue>,
  fields: ValidatableField[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const field of fields) {
    const value = values[field.name];
    const label = field.label || field.name;
    const add = (message: string, severity: ValidationSeverity) =>
      issues.push({ field: field.name, label, message, severity });

    // Required — booleans are exempt (false is a legitimate value).
    if (field.required && field.type !== "boolean" && isEmpty(value)) {
      add("is required but empty", "error");
      continue; // no point format-checking an empty value
    }

    if (isEmpty(value)) continue;
    if (typeof value !== "string") continue; // booleans need no format check

    switch (field.type) {
      case "number": {
        if (Number.isNaN(Number(value))) add("must be a number", "error");
        break;
      }
      case "date":
      case "datetime": {
        if (Number.isNaN(new Date(value).getTime())) {
          add("is not a valid date", "error");
        }
        break;
      }
      case "select": {
        const allowed = splitOptions(field.options);
        if (allowed.length > 0 && !allowed.includes(value.trim())) {
          add(`must be one of: ${allowed.join(", ")}`, "error");
        }
        break;
      }
      case "multiselect": {
        const allowed = splitOptions(field.options);
        if (allowed.length > 0) {
          const invalid = value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
            .filter((v) => !allowed.includes(v));
          if (invalid.length > 0) {
            add(`has values not in the list: ${invalid.join(", ")}`, "error");
          }
        }
        break;
      }
      case "url": {
        if (!/^https?:\/\//i.test(value.trim())) {
          add("doesn't look like a URL (expected http/https)", "warning");
        }
        break;
      }
      case "color": {
        if (!/^#[0-9a-fA-F]{3,8}$/.test(value.trim())) {
          add("doesn't look like a hex color", "warning");
        }
        break;
      }
      default:
        break;
    }
  }

  return issues;
}

/** Convenience tally for rendering a status badge. */
export function summarizeIssues(issues: ValidationIssue[]): {
  errors: number;
  warnings: number;
  ok: boolean;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === "error") errors++;
    else warnings++;
  }
  return { errors, warnings, ok: errors === 0 && warnings === 0 };
}
