"use client";

import type { CredentialValues } from "@wryte/logic/lib/media-credentials";
import type { MediaProviderEntry } from "@wryte/logic/types/media";
import { InfoHint } from "@wryte/ui/info-hint";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

/**
 * Renders a storage provider's credential inputs from its registry entry.
 *
 * There is deliberately no per-provider branch here: the shape of the form is
 * data (`entry.fields`), so connecting a new provider is a registry entry, not
 * another copy of this JSX. Used by both project settings and the new-project
 * wizard.
 *
 * Secret fields render as password inputs behind a single reveal toggle, and
 * their placeholder changes once a credential exists so it's clear that leaving
 * them blank keeps the stored value.
 */
export function CredentialFieldsForm({
  entry,
  values,
  onChange,
  hasExisting = false,
  idPrefix,
}: {
  entry: MediaProviderEntry;
  values: CredentialValues;
  onChange: (key: string, value: string) => void;
  /** A credential is already stored — secrets are being replaced, not set. */
  hasExisting?: boolean;
  /** Namespaces input ids so two forms can coexist on one page. */
  idPrefix: string;
}) {
  const [showSecrets, setShowSecrets] = useState(false);

  if (entry.fields.length === 0) return null;

  return (
    <div
      className={
        entry.fields.length > 2 ? "grid gap-3 sm:grid-cols-2" : "space-y-3"
      }
    >
      {entry.fields.map((field) => {
        const id = `${idPrefix}-${field.key}`;
        const label =
          field.secret && hasExisting ? `Replace ${field.label}` : field.label;
        // Secret fields arrive blank because stored secrets never leave the
        // server. Blank means "keep what's saved", so the placeholder has to
        // say that rather than look like an empty required field.
        const placeholder =
          field.secret && hasExisting
            ? "Unchanged — type to replace"
            : (field.placeholder ?? "");

        return (
          <div key={field.key} className="space-y-1.5">
            <span className="flex items-center">
              <Label
                htmlFor={id}
                className="text-xs font-medium text-muted-foreground"
              >
                {label}
                {field.optional && (
                  <span className="ml-1 text-muted-foreground/60">
                    (optional)
                  </span>
                )}
              </Label>
              {/* Behind the ⓘ, not under the input: a five-field form with a
                  paragraph per field is unreadable. */}
              {field.hint && <InfoHint>{field.hint}</InfoHint>}
            </span>
            <div className="relative">
              <Input
                id={id}
                type={field.secret && !showSecrets ? "password" : "text"}
                value={values[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                className={
                  field.secret ? "pr-9 font-mono text-xs" : "font-mono text-xs"
                }
              />
              {field.secret && (
                <button
                  type="button"
                  onClick={() => setShowSecrets((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showSecrets ? "Hide secrets" : "Show secrets"}
                >
                  {showSecrets ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
