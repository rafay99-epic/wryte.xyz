import {
  createDefaultMapFromCDN,
  createSystem,
  createVirtualTypeScriptEnvironment,
  type VirtualTypeScriptEnvironment,
} from "@typescript/vfs";
import type ts from "typescript";

export const ANIMATION_ENTRY_FILE = "/animation.tsx";

const REACT_TYPES_VERSION = "19.2.17";
const CSSTYPE_VERSION = "3.2.3";
const TYPE_CACHE = "wryte-animation-types-v1";

const VENDORED_TYPES = [
  {
    path: "/node_modules/@types/react/index.d.ts",
    url: `https://cdn.jsdelivr.net/npm/@types/react@${REACT_TYPES_VERSION}/index.d.ts`,
  },
  {
    path: "/node_modules/@types/react/global.d.ts",
    url: `https://cdn.jsdelivr.net/npm/@types/react@${REACT_TYPES_VERSION}/global.d.ts`,
  },
  {
    path: "/node_modules/@types/react/jsx-runtime.d.ts",
    url: `https://cdn.jsdelivr.net/npm/@types/react@${REACT_TYPES_VERSION}/jsx-runtime.d.ts`,
  },
  {
    path: "/node_modules/csstype/index.d.ts",
    url: `https://cdn.jsdelivr.net/npm/csstype@${CSSTYPE_VERSION}/index.d.ts`,
  },
] as const;

export function animationCompilerOptions(tsApi: typeof ts): ts.CompilerOptions {
  return {
    target: tsApi.ScriptTarget.ES2022,
    lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    module: tsApi.ModuleKind.ESNext,
    moduleResolution: tsApi.ModuleResolutionKind.Bundler,
    jsx: tsApi.JsxEmit.ReactJSX,
    jsxImportSource: "react",
    baseUrl: "/",
    paths: {
      react: ["/node_modules/@types/react/index.d.ts"],
      "react/jsx-runtime": ["/node_modules/@types/react/jsx-runtime.d.ts"],
      csstype: ["/node_modules/csstype/index.d.ts"],
    },
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noPropertyAccessFromIndexSignature: true,
    noImplicitOverride: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
    allowUnreachableCode: false,
    erasableSyntaxOnly: true,
    isolatedModules: true,
    skipLibCheck: true,
    noEmit: true,
  };
}

async function cachingFetch(url: string): Promise<Response> {
  if (typeof caches === "undefined") return await fetch(url);

  const cache = await caches.open(TYPE_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;

  const response = await fetch(url);
  if (response.ok) await cache.put(url, response.clone());
  return response;
}

async function loadVendoredTypes(): Promise<Map<string, string>> {
  const entries = await Promise.all(
    VENDORED_TYPES.map(async ({ path, url }) => {
      const response = await cachingFetch(url);
      if (!response.ok) {
        throw new Error(`${url} responded ${String(response.status)}`);
      }
      return [path, await response.text()] as const;
    }),
  );
  return new Map(entries);
}

export async function createAnimationEnvironment(
  tsApi: typeof ts,
): Promise<VirtualTypeScriptEnvironment> {
  const options = animationCompilerOptions(tsApi);
  const [libs, vendored] = await Promise.all([
    createDefaultMapFromCDN(
      options,
      tsApi.version,
      false,
      tsApi,
      undefined,
      cachingFetch,
    ),
    loadVendoredTypes(),
  ]);

  for (const [path, content] of vendored) libs.set(path, content);
  libs.set(ANIMATION_ENTRY_FILE, "");

  const system = createSystem(libs);
  return createVirtualTypeScriptEnvironment(
    system,
    [ANIMATION_ENTRY_FILE],
    tsApi,
    options,
  );
}
