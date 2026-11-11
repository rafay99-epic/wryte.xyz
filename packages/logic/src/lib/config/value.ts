export class OpaqueValue {
  readonly text: string;

  constructor(text: string) {
    this.text = text;
  }
}

export type ConfigScalar = string | number | boolean | null;

export type ConfigValue =
  | ConfigScalar
  | OpaqueValue
  | ConfigValue[]
  | { [key: string]: ConfigValue };

export type ConfigObject = { [key: string]: ConfigValue };

export type EditableValue =
  | ConfigScalar
  | EditableValue[]
  | { [key: string]: EditableValue };

export type ConfigPath = readonly (string | number)[];

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

export function isConfigObject(value: ConfigValue): value is ConfigObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof OpaqueValue)
  );
}

export function toConfigValue(raw: unknown): ConfigValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string" || typeof raw === "boolean") return raw;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : new OpaqueValue(String(raw));
  }
  if (Array.isArray(raw)) return raw.map(toConfigValue);
  if (isPlainObject(raw)) {
    const result: ConfigObject = {};
    for (const [key, value] of Object.entries(raw)) {
      result[key] = toConfigValue(value);
    }
    return result;
  }
  return new OpaqueValue(String(raw));
}

export function blankLike(value: ConfigValue): EditableValue {
  if (typeof value === "string") return "";
  if (typeof value === "number") return 0;
  if (typeof value === "boolean") return false;
  if (value === null || value instanceof OpaqueValue) return "";
  if (Array.isArray(value)) return [];
  const result: { [key: string]: EditableValue } = {};
  for (const [key, child] of Object.entries(value)) {
    result[key] = blankLike(child);
  }
  return result;
}

export function itemLabel(value: ConfigValue, index: number): string {
  if (isConfigObject(value)) {
    for (const child of Object.values(value)) {
      if (typeof child === "string" && child.trim() !== "") return child;
    }
  }
  return `Item ${String(index + 1)}`;
}

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

const MAX_INLINE_COLUMNS = 4;

export function inlineColumns(items: readonly ConfigValue[]): string[] | null {
  const columns: string[] = [];
  for (const item of items) {
    if (!isConfigObject(item)) return null;
    for (const [key, child] of Object.entries(item)) {
      if (Array.isArray(child) || isConfigObject(child)) return null;
      if (!columns.includes(key)) columns.push(key);
    }
  }
  if (columns.length === 0 || columns.length > MAX_INLINE_COLUMNS) return null;
  return columns;
}

export function itemSummary(value: ConfigValue): string {
  if (!isConfigObject(value)) return "";
  const texts = Object.values(value).filter(
    (child): child is string =>
      typeof child === "string" && child.trim() !== "",
  );
  return texts.slice(1, 3).join(" · ");
}
