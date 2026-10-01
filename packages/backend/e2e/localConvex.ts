function deploymentGuard(): void {
  if (!(process.env["CONVEX_DEPLOYMENT"] ?? "").startsWith("local:")) {
    throw new Error("Refusing to run: CONVEX_DEPLOYMENT must be local.");
  }
}

export function tokenIdentifier(jwt: string): string {
  const payload: unknown = JSON.parse(
    Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"),
  );
  if (
    typeof payload === "object" &&
    payload !== null &&
    "iss" in payload &&
    "sub" in payload &&
    typeof payload.iss === "string" &&
    typeof payload.sub === "string"
  ) {
    return `${payload.iss}|${payload.sub}`;
  }
  throw new Error("Session token has no iss/sub");
}

export function convexRun(
  fn: string,
  args: Record<string, unknown>,
  component?: string,
): void {
  deploymentGuard();
  const run = Bun.spawnSync(
    [
      "bunx",
      "convex",
      "run",
      ...(component === undefined ? [] : ["--component", component]),
      fn,
      JSON.stringify(args),
    ],
    { cwd: `${import.meta.dir}/..`, stdout: "ignore", stderr: "pipe" },
  );
  if (run.exitCode !== 0) {
    throw new Error(`convex run ${fn} failed: ${run.stderr.toString()}`);
  }
}

export function resetLimit(name: string, key: string): void {
  convexRun("lib:resetRateLimit", { name, key }, "rateLimiter");
}

export function drainBucket(
  name: string,
  key: string,
  config: { rate: number; period: number; capacity: number },
): void {
  resetLimit(name, key);
  convexRun(
    "lib:rateLimit",
    {
      name,
      key,
      count: config.capacity,
      config: { kind: "token bucket", ...config },
    },
    "rateLimiter",
  );
}
