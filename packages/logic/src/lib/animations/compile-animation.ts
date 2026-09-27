import type React from "react";
import * as ReactNamespace from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { transform } from "sucrase";

export type CompiledAnimation =
  | { ok: true; component: React.ComponentType }
  | { ok: false; error: string };

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

export function compileAnimation(source: string): CompiledAnimation {
  let js: string;
  try {
    js = transform(source, {
      transforms: ["typescript", "jsx", "imports"],
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
