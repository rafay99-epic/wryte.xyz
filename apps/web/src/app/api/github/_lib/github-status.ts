export function githubStatus(err: unknown): number | undefined {
  if (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof err.status === "number"
  ) {
    return err.status;
  }
  return undefined;
}
