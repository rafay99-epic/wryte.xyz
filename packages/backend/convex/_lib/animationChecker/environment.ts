import type ts from "typescript6";

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

async function fetchText(url: string): Promise<string> {
  const response = await cachingFetch(url);
  if (!response.ok) {
    throw new Error(`${url} responded ${String(response.status)}`);
  }
  return await response.text();
}

async function loadVendoredTypes(): Promise<Map<string, string>> {
  const entries = await Promise.all(
    VENDORED_TYPES.map(
      async ({ path, url }) => [path, await fetchText(url)] as const,
    ),
  );
  return new Map(entries);
}

const LIB_REFERENCE = /\/\/\/\s*<reference\s+lib="([^"]+)"/g;

async function loadLibFiles(
  version: string,
  roots: readonly string[],
): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  let pending = [...roots];
  while (pending.length > 0) {
    const batch = pending.filter((name) => !files.has(`/${name}`));
    const loaded = await Promise.all(
      batch.map(async (name) => {
        const text = await fetchText(
          `https://cdn.jsdelivr.net/npm/typescript@${version}/lib/${name}`,
        );
        files.set(`/${name}`, text);
        return [...text.matchAll(LIB_REFERENCE)].map(
          ([, lib]) => `lib.${(lib ?? "").toLowerCase()}.d.ts`,
        );
      }),
    );
    pending = [...new Set(loaded.flat())].filter(
      (name) => !files.has(`/${name}`),
    );
  }
  return files;
}

export type AnimationEnvironment = {
  diagnostics: (source: string) => ts.Diagnostic[];
};

export async function createAnimationEnvironment(
  tsApi: typeof ts,
): Promise<AnimationEnvironment> {
  const options = animationCompilerOptions(tsApi);
  const [libs, vendored] = await Promise.all([
    loadLibFiles(tsApi.version, options.lib ?? []),
    loadVendoredTypes(),
  ]);
  const files = new Map([...libs, ...vendored]);

  let entry = { text: "", version: 0 };
  const read = (fileName: string): string | undefined =>
    fileName === ANIMATION_ENTRY_FILE ? entry.text : files.get(fileName);

  const host: ts.LanguageServiceHost = {
    getCompilationSettings: () => options,
    getScriptFileNames: () => [ANIMATION_ENTRY_FILE],
    getScriptVersion: (fileName) =>
      fileName === ANIMATION_ENTRY_FILE ? String(entry.version) : "0",
    getScriptSnapshot: (fileName) => {
      const text = read(fileName);
      return text === undefined
        ? undefined
        : tsApi.ScriptSnapshot.fromString(text);
    },
    getCurrentDirectory: () => "/",
    getDefaultLibFileName: () => "/lib.d.ts",
    fileExists: (fileName) => read(fileName) !== undefined,
    readFile: read,
    directoryExists: (directory) =>
      [...files.keys()].some((fileName) => fileName.startsWith(directory)),
    getDirectories: () => [],
  };
  const languageService = tsApi.createLanguageService(host);

  return {
    diagnostics: (source) => {
      entry = { text: source, version: entry.version + 1 };
      return [
        ...languageService.getSyntacticDiagnostics(ANIMATION_ENTRY_FILE),
        ...languageService.getSemanticDiagnostics(ANIMATION_ENTRY_FILE),
      ];
    },
  };
}
