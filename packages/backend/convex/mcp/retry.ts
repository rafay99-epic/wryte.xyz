export function retrySeconds(retryAfterMs: number | undefined): number {
  return retryAfterMs === undefined
    ? 1
    : Math.max(1, Math.ceil(retryAfterMs / 1000));
}

export function retryMessage(retryAfterMs: number | undefined): string {
  return `Rate limited: retry in ${String(retrySeconds(retryAfterMs))} s`;
}
