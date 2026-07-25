"use strict";

// Binary resolution for agent CLIs.
//
// A packaged .app launched from Finder inherits a minimal PATH — not the one
// your shell profile builds. `claude` lives in ~/.local/bin, which such a
// process cannot see, so a naive `spawn("claude")` reports "not installed" on
// every machine except a dev box started from a terminal.
//
// So: try the inherited PATH first (fast, correct when launched from a shell),
// then fall back to asking the user's login shell where the binary is.

const { execFile, execFileSync } = require("node:child_process");
const logger = require("../logger.cjs");

/** @type {Map<string, string | null>} */
const cache = new Map();

/**
 * Ask the user's login shell to resolve a command. Costs ~100ms, so the result
 * is cached for the process lifetime.
 * @param {string} name
 * @returns {string | null}
 */
function resolveViaLoginShell(name) {
  const shell = process.env["SHELL"] || "/bin/zsh";
  try {
    const out = execFileSync(shell, ["-lic", `command -v ${name}`], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const resolved = out.trim().split("\n").pop()?.trim();
    return resolved?.startsWith("/") ? resolved : null;
  } catch {
    return null;
  }
}

/**
 * Absolute path to an agent CLI, or null when it isn't installed.
 * @param {string} name
 * @returns {string | null}
 */
function resolveBinary(name) {
  if (cache.has(name)) return cache.get(name) ?? null;

  let resolved = null;
  try {
    const out = execFileSync("/usr/bin/which", [name], {
      encoding: "utf8",
      timeout: 3000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const candidate = out.trim();
    if (candidate.startsWith("/")) resolved = candidate;
  } catch {
    // Not on the inherited PATH — expected for a Finder-launched app.
  }

  if (!resolved) resolved = resolveViaLoginShell(name);

  logger.info(`harness: ${name} -> ${resolved ?? "not found"}`);
  cache.set(name, resolved);
  return resolved;
}

/**
 * Probe a harness: is it installed, and what version.
 * @param {string} name
 * @returns {Promise<{ id: string, installed: boolean, path: string | null, version: string | null }>}
 */
function probe(name) {
  return new Promise((resolve) => {
    const binaryPath = resolveBinary(name);
    if (!binaryPath) {
      resolve({ id: name, installed: false, path: null, version: null });
      return;
    }
    execFile(binaryPath, ["--version"], { timeout: 8000 }, (error, stdout) => {
      resolve({
        id: name,
        installed: true,
        path: binaryPath,
        version: error ? null : stdout.trim().split("\n")[0] || null,
      });
    });
  });
}

module.exports = { resolveBinary, probe };
