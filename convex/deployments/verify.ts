/**
 * Deployment verification — after a publish commit lands on GitHub, confirm
 * the connected host actually built and deployed it, and email the user when
 * it didn't ("committed but not deployed").
 *
 * Two tiers:
 *   - vercel: authenticated API check per configured `deployment_targets`
 *     row — exact build state (READY/ERROR) matched by commit SHA, with a
 *     link to the failing build's logs.
 *   - url_poll: zero-config fallback for NEW posts when no integration is
 *     connected — poll the published URL until it returns 200. Provider
 *     agnostic (Netlify/Cloudflare/anything). Updates are skipped: their
 *     URL already resolves, so a 200 proves nothing.
 *
 * Cost model: no crons, no standing polling. Checks are scheduled only when
 * a publish happens (≤ ~14 function calls per post worst case), so Convex
 * free-tier usage stays flat.
 */
import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "../_generated/server";

export const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

/**
 * Minutes to wait before each check attempt (index = attempts so far).
 * Sums to ~32 minutes after the commit — generous for any static-site build.
 */
const CHECK_DELAYS_MINUTES = [2, 3, 5, 10, 12];

type CheckOutcome = {
  state: "deployed" | "failed" | "pending";
  reason?: string;
  deploymentUrl?: string;
};

/**
 * Kick off verification for a fresh publish commit. Called via
 * `ctx.scheduler.runAfter(0, ...)` from `publishToGithub`.
 */
export const start = internalMutation({
  args: {
    projectId: v.id("projects"),
    documentId: v.id("documents"),
    userId: v.id("users"),
    commitSha: v.string(),
    commitUrl: v.optional(v.string()),
    publishedUrl: v.optional(v.string()),
    documentTitle: v.string(),
    isUpdate: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const targets = (
      await ctx.db
        .query("deployment_targets")
        .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
        .collect()
    ).filter((t) => t.enabled);

    const rows: Array<{
      method: "vercel" | "url_poll";
      targetId?: Doc<"deployment_targets">["_id"];
    }> = [];
    if (targets.length > 0) {
      for (const t of targets) rows.push({ method: "vercel", targetId: t._id });
    } else if (args.publishedUrl && !args.isUpdate) {
      rows.push({ method: "url_poll" });
    }
    // No targets, no usable URL (or an update) — nothing we can verify.

    for (const row of rows) {
      const verificationId = await ctx.db.insert("deploy_verifications", {
        projectId: args.projectId,
        documentId: args.documentId,
        userId: args.userId,
        method: row.method,
        commitSha: args.commitSha,
        documentTitle: args.documentTitle,
        status: "pending",
        attempts: 0,
        createdAt: Date.now(),
        ...(row.targetId ? { targetId: row.targetId } : {}),
        ...(args.commitUrl ? { commitUrl: args.commitUrl } : {}),
        ...(args.publishedUrl ? { publishedUrl: args.publishedUrl } : {}),
      });
      await ctx.scheduler.runAfter(
        (CHECK_DELAYS_MINUTES[0] ?? 2) * 60_000,
        internal.deployments.verify.check,
        { verificationId },
      );
    }

    // Retention cap — newest 20 verifications per document, mirroring the
    // publish_history pattern. Without this the table grows one row per
    // publish per target forever (it was the only per-publish table with
    // no cap and no purge coverage).
    const DEPLOY_VERIFICATION_CAP = 20;
    const overflow = await ctx.db
      .query("deploy_verifications")
      .withIndex("by_documentId", (q) => q.eq("documentId", args.documentId))
      .order("desc")
      .take(DEPLOY_VERIFICATION_CAP + 10);
    for (const row of overflow.slice(DEPLOY_VERIFICATION_CAP)) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

export const getForCheck = internalQuery({
  args: { verificationId: v.id("deploy_verifications") },
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification) return null;
    const target = verification.targetId
      ? await ctx.db.get(verification.targetId)
      : null;
    return { verification, target };
  },
});

/** One check attempt. Reschedules itself (via recordResult) while pending. */
export const check = internalAction({
  args: { verificationId: v.id("deploy_verifications") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const data: {
      verification: Doc<"deploy_verifications">;
      target: Doc<"deployment_targets"> | null;
    } | null = await ctx.runQuery(internal.deployments.verify.getForCheck, {
      verificationId: args.verificationId,
    });
    if (!data || data.verification.status !== "pending") return null;
    const { verification, target } = data;

    let outcome: CheckOutcome;
    if (verification.method === "vercel" && target) {
      let token: string | null = null;
      try {
        token = await ctx.runAction(internal.integrations.secretStore._read, {
          id: target.vaultSecretId,
        });
      } catch {
        // Transient vault outage — leave pending, the next attempt retries.
      }
      outcome = token
        ? await checkVercel(token, target, verification)
        : { state: "pending" };
    } else if (verification.publishedUrl) {
      outcome = await checkUrl(
        verification.publishedUrl,
        verification.attempts,
      );
    } else {
      outcome = {
        state: "failed",
        reason: "No verification method available.",
      };
    }

    await ctx.runMutation(internal.deployments.verify.recordResult, {
      verificationId: args.verificationId,
      state: outcome.state,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
      ...(outcome.deploymentUrl
        ? { deploymentUrl: outcome.deploymentUrl }
        : {}),
    });
    return null;
  },
});

export const recordResult = internalMutation({
  args: {
    verificationId: v.id("deploy_verifications"),
    state: v.union(
      v.literal("deployed"),
      v.literal("failed"),
      v.literal("pending"),
    ),
    reason: v.optional(v.string()),
    deploymentUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const verification = await ctx.db.get(args.verificationId);
    if (!verification || verification.status !== "pending") return null;

    if (args.state === "deployed") {
      await ctx.db.patch(args.verificationId, {
        status: "deployed",
        resolvedAt: Date.now(),
      });
      return null;
    }

    if (args.state === "pending") {
      const attempts = verification.attempts + 1;
      const nextDelay = CHECK_DELAYS_MINUTES[attempts];
      if (nextDelay !== undefined) {
        await ctx.db.patch(args.verificationId, { attempts });
        await ctx.scheduler.runAfter(
          nextDelay * 60_000,
          internal.deployments.verify.check,
          { verificationId: args.verificationId },
        );
        return null;
      }
      // Out of attempts — committed, but never confirmed deployed.
      await ctx.db.patch(args.verificationId, {
        status: "timeout",
        attempts,
        resolvedAt: Date.now(),
      });
      await sendNotDeployedEmail(ctx, verification, { timedOut: true });
      return null;
    }

    await ctx.db.patch(args.verificationId, {
      status: "failed",
      resolvedAt: Date.now(),
      ...(args.reason ? { failReason: args.reason } : {}),
      ...(args.deploymentUrl ? { deploymentUrl: args.deploymentUrl } : {}),
    });
    await sendNotDeployedEmail(
      ctx,
      {
        ...verification,
        ...(args.reason ? { failReason: args.reason } : {}),
        ...(args.deploymentUrl ? { deploymentUrl: args.deploymentUrl } : {}),
      },
      { timedOut: false },
    );
    return null;
  },
});

/* ------------------------------------------------------------------ */
/*  Provider checks                                                    */
/* ------------------------------------------------------------------ */

interface VercelDeployment {
  state?: string;
  createdAt?: number;
  inspectorUrl?: string;
  meta?: { githubCommitSha?: string };
}

async function checkVercel(
  token: string,
  target: Doc<"deployment_targets">,
  verification: Doc<"deploy_verifications">,
): Promise<CheckOutcome> {
  const params = new URLSearchParams({
    projectId: target.providerProjectId,
    target: "production",
    limit: "20",
  });
  if (target.teamId) params.set("teamId", target.teamId);

  let res: Response;
  try {
    res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return { state: "pending" }; // network blip — retry next attempt
  }
  if (res.status === 401 || res.status === 403) {
    return {
      state: "failed",
      reason:
        "Vercel rejected the API token. Reconnect the deployment integration in project settings.",
    };
  }
  if (!res.ok) return { state: "pending" };

  const body = (await res.json()) as { deployments?: VercelDeployment[] };
  const deployments = body.deployments ?? [];
  const match = deployments.find(
    (d) => d.meta?.githubCommitSha === verification.commitSha,
  );
  if (match) {
    const link = match.inspectorUrl
      ? { deploymentUrl: match.inspectorUrl }
      : {};
    if (match.state === "READY") return { state: "deployed" };
    if (match.state === "ERROR")
      return { state: "failed", reason: "The Vercel build failed.", ...link };
    if (match.state === "CANCELED")
      return {
        state: "failed",
        reason: "The Vercel deployment was canceled.",
        ...link,
      };
    return { state: "pending" }; // QUEUED | INITIALIZING | BUILDING
  }

  // Vercel skips intermediate builds when commits land back-to-back: our SHA
  // may never get its own deployment, but a newer successful production
  // deploy started after our commit necessarily includes it.
  const superseded = deployments.some(
    (d) => d.state === "READY" && (d.createdAt ?? 0) > verification.createdAt,
  );
  if (superseded) return { state: "deployed" };
  return { state: "pending" };
}

async function checkUrl(url: string, attempt: number): Promise<CheckOutcome> {
  try {
    // Cache-buster so a CDN-cached 404 can't mask a successful deploy.
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}wryteVerify=${attempt}`, {
      redirect: "follow",
    });
    return res.ok ? { state: "deployed" } : { state: "pending" };
  } catch {
    return { state: "pending" };
  }
}

/* ------------------------------------------------------------------ */
/*  Notification email                                                 */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendNotDeployedEmail(
  ctx: MutationCtx,
  verification: Doc<"deploy_verifications">,
  opts: { timedOut: boolean },
): Promise<void> {
  if (verification.emailSentAt) return;
  const user = await ctx.db.get(verification.userId);
  if (!user?.email) return;
  // Document deleted while we were checking — nothing to notify about.
  const doc = await ctx.db.get(verification.documentId);
  if (!doc) return;

  const title = escapeHtml(verification.documentTitle);
  const what = opts.timedOut
    ? verification.method === "url_poll"
      ? "Its URL still isn't reachable ~30 minutes later, so the deployment may have failed or been skipped."
      : "No successful deployment for this commit appeared within ~30 minutes."
    : (verification.failReason ?? "The deployment failed.");

  const links: string[] = [];
  if (verification.deploymentUrl) {
    links.push(
      `<a href="${verification.deploymentUrl}">View the build logs</a>`,
    );
  }
  if (verification.commitUrl) {
    links.push(`<a href="${verification.commitUrl}">View the commit</a>`);
  }
  if (verification.publishedUrl) {
    links.push(`<a href="${verification.publishedUrl}">Check the live URL</a>`);
  }

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <h2 style="font-size:18px">Your post was committed, but it hasn't deployed</h2>
      <p><strong>&ldquo;${title}&rdquo;</strong> was committed to GitHub successfully, but ${escapeHtml(what)}</p>
      <p>Your readers won't see the post until your site rebuilds. Check your host's deploy logs and re-deploy if needed.</p>
      ${links.length ? `<p>${links.join(" &nbsp;&middot;&nbsp; ")}</p>` : ""}
      <p style="color:#6b7280;font-size:13px">Sent by Wryte deployment verification. You get at most one of these per publish.</p>
    </div>`;

  await resend.sendEmail(ctx, {
    from: process.env["RESEND_FROM_EMAIL"] ?? "Wryte <onboarding@resend.dev>",
    to: user.email,
    subject: `"${verification.documentTitle}" was committed but hasn't deployed`,
    html,
  });
  await ctx.db.patch(verification._id, { emailSentAt: Date.now() });
}
