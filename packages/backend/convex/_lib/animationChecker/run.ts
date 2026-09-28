import type ts from "typescript6";
import type {
  ActiveCheckLevel,
  AnimationCheckResult,
  AnimationDiagnostic,
  AnimationLanguage,
  TypecheckState,
} from "../animationChecks";
import { runContractChecks } from "./contract";
import {
  ANIMATION_ENTRY_FILE,
  type AnimationEnvironment,
  createAnimationEnvironment,
} from "./environment";

export type AnimationCheckRequest = {
  level: ActiveCheckLevel;
  language: AnimationLanguage;
  source: string;
};

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

export function createAnimationChecker(
  loadTypeScript: () => Promise<typeof ts>,
): (request: AnimationCheckRequest) => Promise<AnimationCheckResult> {
  let environment: Promise<AnimationEnvironment> | null = null;

  const loadEnvironment = (tsApi: typeof ts) => {
    environment ??= createAnimationEnvironment(tsApi).catch(
      (error: unknown) => {
        environment = null;
        throw error;
      },
    );
    return environment;
  };

  const typecheck = async (
    tsApi: typeof ts,
    source: string,
  ): Promise<{ diagnostics: AnimationDiagnostic[]; state: TypecheckState }> => {
    try {
      const env = await loadEnvironment(tsApi);
      const diagnostics = env.diagnostics(source).flatMap((diagnostic) => {
        const mapped = toAnimationDiagnostic(tsApi, diagnostic);
        return mapped === null ? [] : [mapped];
      });
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
  };

  return async (request) => {
    try {
      const tsApi = await loadTypeScript();
      const sourceFile = tsApi.createSourceFile(
        ANIMATION_ENTRY_FILE,
        request.source,
        tsApi.ScriptTarget.ES2022,
        true,
        request.language === "jsx"
          ? tsApi.ScriptKind.JSX
          : tsApi.ScriptKind.TSX,
      );

      const diagnostics = runContractChecks(
        tsApi,
        sourceFile,
        request.language,
      );
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
  };
}
