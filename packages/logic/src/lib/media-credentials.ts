import type {
  CredentialField,
  MediaProviderEntry,
} from "@wryte/logic/types/media";

export type CredentialValues = Record<string, string>;

function trimmed(values: CredentialValues, key: string): string {
  return (values[key] ?? "").trim();
}

export function missingCredentialFields(
  entry: MediaProviderEntry,
  values: CredentialValues,
  opts: { hasExisting?: boolean } = {},
): CredentialField[] {
  return entry.fields.filter((field) => {
    if (field.optional) return false;
    if (opts.hasExisting && field.secret) return false;
    return trimmed(values, field.key) === "";
  });
}

export function buildCredentialSecret(
  entry: MediaProviderEntry,
  values: CredentialValues,
  opts: { hasExisting?: boolean } = {},
): string | null {
  if (missingCredentialFields(entry, values, opts).length > 0) return null;

  if (entry.secretFormat === "raw") {
    const first = entry.fields[0];
    if (!first) return null;
    const value = trimmed(values, first.key);
    if (value !== "") return value;
    return opts.hasExisting ? "" : null;
  }

  const secret: Record<string, string> = {};
  for (const field of entry.fields) {
    if (field.excludeFromSecret) continue;
    const value = trimmed(values, field.key);
    if (value === "") continue;
    secret[field.key] = value;
  }
  if (Object.keys(secret).length === 0) return opts.hasExisting ? "{}" : null;
  return JSON.stringify(secret);
}
