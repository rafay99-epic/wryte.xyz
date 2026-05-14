import type { ResolvedFormat } from "./types";

/**
 * Message shapes for the compression worker. Defined separately from the
 * worker module so that `worker-client.ts` can import the types without
 * pulling the worker's runtime code into the main thread.
 */

export type EncodeRequestMessage = {
  id: number;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  format: ResolvedFormat;
  quality: number;
  flattenWhite: boolean;
  cornerRadius: number;
};

export type EncodeSuccessMessage = {
  id: number;
  ok: true;
  blob: Blob;
  width: number;
  height: number;
  resolvedFormat: ResolvedFormat;
};

export type EncodeFailureMessage = {
  id: number;
  ok: false;
  error: string;
};

export type EncodeResponseMessage = EncodeSuccessMessage | EncodeFailureMessage;
