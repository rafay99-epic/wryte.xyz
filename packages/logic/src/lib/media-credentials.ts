/**
 * Turning a provider's credential form into the two strings the backend wants:
 * the vault `secret` and the non-secret `publicConfig`.
 *
 * Both the project-settings form and the new-project wizard use these, so the
 * serialisation lives in one place and a new provider needs no new code — its
 * `fields` entry in the media provider registry is the whole definition.
 */

import type {
  CredentialField,
  MediaProviderEntry,
} from "@wryte/logic/types/media";

/** Form state: field key → raw input value. */
export type CredentialValues = Record<string, string>;

function trimmed(values: CredentialValues, key: string): string {
  return (values[key] ?? "").trim();
}

/** Fields the user still has to fill in before saving is possible. */
export function missingCredentialFields(
  entry: MediaProviderEntry,
  values: CredentialValues,
): CredentialField[] {
  return entry.fields.filter(
    (field) => !field.optional && trimmed(values, field.key) === "",
  );
}

/**
 * The single string stored in WorkOS Vault.
 *
 * `raw` providers keep one opaque token verbatim; `json` providers get an
 * object keyed by field name, which is exactly what the backend's
 * `parse*Secret` helpers expect. Display-only fields are excluded — a folder
 * label has no business inside a secret.
 */
export function buildCredentialSecret(
  entry: MediaProviderEntry,
  values: CredentialValues,
): string | null {
  if (missingCredentialFields(entry, values).length > 0) return null;

  if (entry.secretFormat === "raw") {
    const first = entry.fields[0];
    if (!first) return null;
    const value = trimmed(values, first.key);
    return value === "" ? null : value;
  }

  const secret: Record<string, string> = {};
  for (const field of entry.fields) {
    if (field.excludeFromSecret) continue;
    const value = trimmed(values, field.key);
    if (value === "") continue;
    secret[field.key] = value;
  }
  return Object.keys(secret).length === 0 ? null : JSON.stringify(secret);
}

/**
 * Non-secret hints mirrored back into the UI after saving (bucket name, cloud
 * name, …). Secret fields are never included, whatever the registry says.
 */
export function buildCredentialPublicConfig(
  entry: MediaProviderEntry,
  values: CredentialValues,
): string | undefined {
  const out: Record<string, string> = {};
  for (const field of entry.fields) {
    if (!field.showAfterSave || field.secret) continue;
    const value = trimmed(values, field.key);
    if (value !== "") out[field.key] = value;
  }
  return Object.keys(out).length === 0 ? undefined : JSON.stringify(out);
}

function camelCase(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

/**
 * Reads the stored `publicConfig` blob.
 *
 * Cloudinary rows written before the registry stored camelCased keys
 * (`cloudName`), so each field key is also looked up in that form — otherwise
 * existing projects would stop showing what they're connected to.
 */
export function readCredentialPublicConfig(
  raw: string | null | undefined,
): (key: string) => string | null {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const candidate: unknown = JSON.parse(raw);
      if (
        candidate &&
        typeof candidate === "object" &&
        !Array.isArray(candidate)
      ) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      // Malformed blob — treat as empty rather than breaking the form.
    }
  }
  return (key: string): string | null => {
    const value = parsed[key] ?? parsed[camelCase(key)];
    return typeof value === "string" && value !== "" ? value : null;
  };
}
