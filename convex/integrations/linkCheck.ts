/**
 * On-demand dead-link checker. Strictly user-initiated (no cron): scans a
 * project's documents for external URLs, probes each with a bounded
 * worker pool, and reports the broken ones with the documents they
 * appear in. Runs in the default Convex runtime — `fetch` needs no Node.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action } from "../_generated/server";
import { getRateLimitKey, rateLimiter } from "../_lib/rateLimits";

/** Hard cap on URLs probed per run — anything beyond is reported, not silently dropped. */
const MAX_LINKS = 150;
const CONCURRENCY = 8;
const TIMEOUT_MS = 8000;

const URL_RE = /https?:\/\/[^\s)\]"'<>`]+/g;

export type BrokenLink = {
  url: string;
  reason: string;
  documents: { id: string; title: string }[];
};

export type LinkCheckResult = {
  documentsScanned: number;
  totalLinks: number;
  checked: number;
  truncated: number;
  broken: BrokenLink[];
};

/** Private/loopback hosts are skipped — nothing useful to probe there. */
function isPrivateHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    );
  } catch {
    return true;
  }
}

async function probe(url: string): Promise<string | null> {
  const attempt = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "wryte-link-check/1.0" },
      });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let res = await attempt("HEAD");
    // Plenty of servers reject HEAD outright — confirm with GET before
    // calling it broken.
    if (res.status === 403 || res.status === 405 || res.status === 501) {
      res = await attempt("GET");
    }
    return res.status >= 400 ? `HTTP ${res.status}` : null;
  } catch {
    try {
      const res = await attempt("GET");
      return res.status >= 400 ? `HTTP ${res.status}` : null;
    } catch {
      return "Unreachable (timeout or DNS failure)";
    }
  }
}

export const run = action({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args): Promise<LinkCheckResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const key = await getRateLimitKey(ctx);
    await rateLimiter.limit(ctx, "tools:linkCheck", { key, throws: true });

    const docs = await ctx.runQuery(internal.cms.documents._listForLinkCheck, {
      tokenIdentifier: identity.tokenIdentifier,
      projectId: args.projectId,
    });
    if (!docs) throw new Error("Unauthorized");

    /* ── Extract & dedupe external URLs across all documents ── */
    const linkMap = new Map<string, { id: string; title: string }[]>();
    for (const doc of docs) {
      const seen = new Set<string>();
      for (const match of doc.content.matchAll(URL_RE)) {
        // Trim trailing punctuation that markdown prose drags along.
        const url = (match[0] as string).replace(/[.,;:!?]+$/, "");
        if (seen.has(url) || isPrivateHost(url)) continue;
        seen.add(url);
        const entry = linkMap.get(url) ?? [];
        entry.push({ id: doc._id, title: doc.title });
        linkMap.set(url, entry);
      }
    }

    const urls = [...linkMap.keys()];
    const toCheck = urls.slice(0, MAX_LINKS);
    const broken: BrokenLink[] = [];

    /* ── Bounded worker pool ── */
    let cursor = 0;
    const worker = async () => {
      while (cursor < toCheck.length) {
        const url = toCheck[cursor++] as string;
        const reason = await probe(url);
        if (reason) {
          broken.push({ url, reason, documents: linkMap.get(url) ?? [] });
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, toCheck.length) }, worker),
    );

    broken.sort((a, b) => a.url.localeCompare(b.url));
    return {
      documentsScanned: docs.length,
      totalLinks: urls.length,
      checked: toCheck.length,
      truncated: Math.max(0, urls.length - toCheck.length),
      broken,
    };
  },
});
