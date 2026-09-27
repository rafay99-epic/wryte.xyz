import type { ReadabilityResult } from "./types";

export type AnalyzeRequestMessage = {
  id: number;
  text: string;
};

export type AnalyzeSuccessMessage = {
  id: number;
  ok: true;
  result: ReadabilityResult;
};

export type AnalyzeFailureMessage = {
  id: number;
  ok: false;
  error: string;
};

export type AnalyzeResponseMessage =
  | AnalyzeSuccessMessage
  | AnalyzeFailureMessage;
