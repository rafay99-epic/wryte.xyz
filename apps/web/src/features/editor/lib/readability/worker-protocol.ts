import type { ReadabilityResult } from "./types";

/**
 * Message shapes for the readability worker. Kept separate from the worker
 * module so `worker-client.ts` imports only the types (no worker runtime).
 */

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
