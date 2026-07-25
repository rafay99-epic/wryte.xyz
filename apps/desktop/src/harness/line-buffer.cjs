"use strict";

/**
 * Newline-delimited stream reassembly.
 *
 * A `data` chunk from a child process boundary has nothing to do with a line
 * boundary — a single JSON object routinely arrives split across two chunks.
 * Parsing per-chunk silently drops those objects. Everything that reads NDJSON
 * from a subprocess goes through this.
 *
 * @param {(line: string) => void} onLine
 */
function createLineBuffer(onLine) {
  let remainder = "";

  return {
    /** @param {string} chunk */
    push(chunk) {
      const lines = (remainder + chunk).split("\n");
      // The last element is either "" (chunk ended on a newline) or a partial
      // line that must wait for the next chunk.
      remainder = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, "");
        if (trimmed) onLine(trimmed);
      }
    },
    /** Emit any trailing partial line. Call once on stream end. */
    flush() {
      const trimmed = remainder.replace(/\r$/, "").trim();
      remainder = "";
      if (trimmed) onLine(trimmed);
    },
  };
}

module.exports = { createLineBuffer };
