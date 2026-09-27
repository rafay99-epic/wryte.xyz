/**
 * HTTP status carried by an Octokit `RequestError` (or anything shaped like
 * one), or `undefined` for other errors. Lets route handlers map GitHub
 * 401/404 responses without casting the caught value.
 */
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
