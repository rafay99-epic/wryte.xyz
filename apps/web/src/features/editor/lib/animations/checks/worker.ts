import type { VirtualTypeScriptEnvironment } from "@typescript/vfs";
import type { AnimationDiagnostic } from "@wryte/backend/_lib/animationChecks";
import type ts from "typescript";
import { runContractChecks } from "./contract";
import {
  ANIMATION_ENTRY_FILE,
  createAnimationEnvironment,
} from "./environment";
import type { CheckRequest, CheckResponse, TypecheckState } from "./protocol";

let tsModule: Promise<typeof ts> | null = null;
let environment: Promise<VirtualTypeScriptEnvironment> | null = null;

function loadTypeScript(): Promise<typeof ts> {
  tsModule ??= import("typescript").then((module) => module.default ?? module);
  return tsModule;
}

function loadEnvironment(
  tsApi: typeof ts,
): Promise<VirtualTypeScriptEnvironment> {
  environment ??= createAnimationEnvironment(tsApi).catch((error: unknown) => {
    environment = null;
    throw error;
  });
  return environment;
}

function toAnimationDiagnostic(
  tsApi: typeof ts,
  diagnostic: ts.Diagnostic,
): AnimationDiagnostic | null {
  const { file, start } = diagnostic;
  if (file === undefined || start === undefined) return null;

  const { line, character } = file.getLineAndCharacterOfPosition(start);
  return {
    rule: `ts(${String(diagnostic.code)})`,
    severity:
      diagnostic.category === tsApi.DiagnosticCategory.Error
        ? "error"
        : "warning",
    message: tsApi.flattenDiagnosticMessageText(diagnostic.messageText, " "),
    line: line + 1,
    column: character + 1,
  };
}

async function typecheck(
  tsApi: typeof ts,
  source: string,
): Promise<{ diagnostics: AnimationDiagnostic[]; state: TypecheckState }> {
  try {
    const env = await loadEnvironment(tsApi);
    env.updateFile(ANIMATION_ENTRY_FILE, source);

    const raw = [
      ...env.languageService.getSyntacticDiagnostics(ANIMATION_ENTRY_FILE),
      ...env.languageService.getSemanticDiagnostics(ANIMATION_ENTRY_FILE),
    ];

    const diagnostics: AnimationDiagnostic[] = [];
    for (const diagnostic of raw) {
      const mapped = toAnimationDiagnostic(tsApi, diagnostic);
      if (mapped !== null) diagnostics.push(mapped);
    }
    return { diagnostics, state: { kind: "ran" } };
  } catch (error: unknown) {
    return {
      diagnostics: [],
      state: {
        kind: "unavailable",
        reason:
          error instanceof Error
            ? error.message
            : "Type definitions could not be downloaded",
      },
    };
  }
}

async function check(request: CheckRequest): Promise<CheckResponse["result"]> {
  try {
    const tsApi = await loadTypeScript();
    const sourceFile = tsApi.createSourceFile(
      ANIMATION_ENTRY_FILE,
      request.source,
      tsApi.ScriptTarget.ES2022,
      true,
      request.language === "jsx" ? tsApi.ScriptKind.JSX : tsApi.ScriptKind.TSX,
    );

    const diagnostics = runContractChecks(tsApi, sourceFile, request.language);
    // JavaScript sources carry no annotations to check, so the type pass is
    // not offered for them (the setting hides the switch too).
    if (request.level === "contract" || request.language === "jsx") {
      return { kind: "checked", diagnostics, typecheck: { kind: "skipped" } };
    }

    const typed = await typecheck(tsApi, request.source);
    return {
      kind: "checked",
      diagnostics: [...diagnostics, ...typed.diagnostics].sort(
        (a, b) => a.line - b.line || a.column - b.column,
      ),
      typecheck: typed.state,
    };
  } catch (error: unknown) {
    return {
      kind: "failed",
      error: error instanceof Error ? error.message : "Check failed",
    };
  }
}

self.addEventListener("message", (event: MessageEvent<CheckRequest>) => {
  const request = event.data;
  void check(request).then((result) => {
    const response: CheckResponse = { id: request.id, result };
    self.postMessage(response);
  });
});
