const SENTINEL = "__STREAM_ERROR__";

export function extractStreamError(
  streamText: string,
): { error: string; partialContent: string } | null {
  const idx = streamText.indexOf(SENTINEL);
  if (idx === -1) return null;
  return {
    error: streamText.slice(idx + SENTINEL.length),
    partialContent: streamText.slice(0, idx),
  };
}

export function getStreamErrorMessage(
  streamText: string,
  fallback: string,
): string {
  const result = extractStreamError(streamText);
  return result?.error || fallback;
}
