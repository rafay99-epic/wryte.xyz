import type {
  AnimationCheckLevel,
  AnimationDiagnostic,
  AnimationLanguage,
} from "@wryte/backend/_lib/animationChecks";

export type ActiveCheckLevel = Exclude<AnimationCheckLevel, "off">;

export type CheckRequest = {
  id: number;
  level: ActiveCheckLevel;
  language: AnimationLanguage;
  source: string;
};

export type TypecheckState =
  | { kind: "ran" }
  | { kind: "skipped" }
  | { kind: "unavailable"; reason: string };

export type CheckResponse = {
  id: number;
  result:
    | {
        kind: "checked";
        diagnostics: AnimationDiagnostic[];
        typecheck: TypecheckState;
      }
    | { kind: "failed"; error: string };
};
