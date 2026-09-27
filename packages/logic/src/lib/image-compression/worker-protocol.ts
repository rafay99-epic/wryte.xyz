import type { ResolvedFormat } from "./types";

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
