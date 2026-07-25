/**
 * Compiles user-authored animation TSX into a runnable React component,
 * entirely in the browser.
 *
 * Pipeline: Sucrase strips TS types and compiles JSX + ESM to CJS, then the
 * module body runs via `new Function` with a `require` shim that resolves
 * imports from a hard allowlist. Anything off-list throws a friendly error
 * instead of a bundler crash. The default export is the component.
 *
 * Trust model: identical to the MDX preview one pane over — same-context
 * eval of self-authored content (see the trust-boundary note in
 * `mdx-preview.tsx`). If animations ever become shareable between users,
 * both surfaces move into a sandboxed iframe together.
 *
 * The allowlist doubles as the publish-side contract: an import that
 * resolves here must also exist in the target repo's dependencies, so
 * "renders in preview" stays a proxy for "builds in the repo". v1 ships
 * React only — animation libs unlock after the repo-dependency preflight.
 */
import type React from "react";
import * as ReactNamespace from "react";
// react/jsx-runtime is only needed if we ever switch Sucrase to automatic
// JSX. With the classic runtime (React.createElement) it's unused, but a
// pasted file may still import it explicitly — resolve it to keep such
// files working rather than erroring on a legitimate React import.
import * as JsxRuntime from "react/jsx-runtime";
import { transform } from "sucrase";

export type CompiledAnimation =
  | { ok: true; component: React.ComponentType }
  | { ok: false; error: string };

/** Modules a pasted component may import. Keys are import specifiers. */
const IMPORT_ALLOWLIST: Record<string, unknown> = {
  react: ReactNamespace,
  "react/jsx-runtime": JsxRuntime,
};

function requireShim(specifier: string): unknown {
  if (specifier in IMPORT_ALLOWLIST) return IMPORT_ALLOWLIST[specifier];
  throw new Error(
    `Import "${specifier}" isn't available in animations yet. ` +
      `Supported: ${Object.keys(IMPORT_ALLOWLIST).join(", ")}. ` +
      `Keep the component self-contained (inline styles, React hooks).`,
  );
}

/**
 * Compile TSX source and return its default-export component.
 * Synchronous — cheap enough to run per keystroke behind a debounce.
 */
export function compileAnimation(source: string): CompiledAnimation {
  let js: string;
  try {
    js = transform(source, {
      transforms: ["typescript", "jsx", "imports"],
      // Automatic runtime: JSX compiles to jsx() from react/jsx-runtime
      // (resolved by the allowlist) — no `React` global required, matching
      // how Astro/Next compile the same file at build time.
      jsxRuntime: "automatic",
      production: true,
    }).code;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  try {
    const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
    // `new Function` has no closure access — the module only sees the
    // arguments we pass (same isolation level as the MDX preview runner).
    const fn = new Function("require", "module", "exports", js) as (
      req: typeof requireShim,
      mod: typeof moduleObj,
      exp: typeof moduleObj.exports,
    ) => void;
    fn(requireShim, moduleObj, moduleObj.exports);

    const exported = moduleObj.exports["default"];
    if (typeof exported !== "function") {
      return {
        ok: false,
        error:
          "The file must have exactly one `export default function MyComponent() { … }` — no default export was found.",
      };
    }
    return { ok: true, component: exported as React.ComponentType };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
