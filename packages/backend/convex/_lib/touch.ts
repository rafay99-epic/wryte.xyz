export const TOUCH_INTERVAL_MS = 60_000;

export function shouldTouch(args: {
  now: number;
  updatedAt: number;
  flush: boolean;
  titleChanged: boolean;
}): boolean {
  return (
    args.flush ||
    args.titleChanged ||
    args.now - args.updatedAt >= TOUCH_INTERVAL_MS
  );
}
