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

/**
 * Fields the user still has to fill in before saving is possible.
 *
 * When a credential already exists, blank *secret* fields are fine: the form
 * never receives stored secrets, so leaving one empty means "keep it", and the
 * server merges it back from the vault. Non-secret fields are pre-filled, so a
 * blank one there is a genuine deletion the user has to resolve.
 */
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
  opts: { hasExisting?: boolean } = {},
): string | null {
  if (missingCredentialFields(entry, values, opts).length > 0) return null;

  if (entry.secretFormat === "raw") {
    const first = entry.fields[0];
    if (!first) return null;
    const value = trimmed(values, first.key);
    if (value !== "") return value;
    // Blank with a credential stored = "leave the token alone"; the server
    // resolves the empty string back to what's in the vault.
    return opts.hasExisting ? "" : null;
  }

  // Only the fields actually filled in are submitted. Omissions are not
  // erasures — the server folds them into the stored credential.
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
