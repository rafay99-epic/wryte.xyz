import type {
  ActiveCheckLevel,
  AnimationCheckResult,
  AnimationLanguage,
} from "@wryte/backend/_lib/animationChecks";

export type CheckRequest = {
  id: number;
  level: ActiveCheckLevel;
  language: AnimationLanguage;
  source: string;
};

export type CheckResponse = {
  id: number;
  result: AnimationCheckResult;
};
