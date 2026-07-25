/**
 * Credential rotation workflow.
 *
 * The "verify new key → swap pointer → delete old vault entry" sequence is
 * crash-safe: if the deploy restarts after step 2 succeeded, step 3 runs
 * automatically on resume. If verification fails, we surface the error and
 * keep the old vault entry intact — the user can retry with a fresh key.
 *
 * The Node-only verification step lives in `rotateCredentialActions.ts`
 * (this file is regular Convex runtime so it can also expose mutations).
 */
import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { credentialProviderValidator } from "../media/_lib/providers";

const PROVIDER_VALIDATOR = credentialProviderValidator;

export const rotateWorkflowManager = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 2,
      initialBackoffMs: 2000,
      base: 2,
    },
    retryActionsByDefault: false,
  },
});

/**
 * Sequenced rotation:
 *   1. ping the new secret with the active provider — bails on failure
 *   2. store the new secret in the vault
 *   3. swap the row's `vaultSecretId` and mark `active`
 *   4. delete the old vault entry
 */
export const rotateCredentialWorkflow = rotateWorkflowManager.define({
  args: {
    credentialId: v.id("mediaCredentials"),
    provider: PROVIDER_VALIDATOR,
    newSecret: v.string(),
    // Status to revert to if verification fails. Without this, a failed
    // rotation of an `"invalid"` row was incorrectly promoting it to
    // `"active"`.
    priorStatus: v.union(v.literal("active"), v.literal("invalid")),
  },
  handler: async (step, args) => {
    const verify = await step.runAction(
      internal.workflows.rotateCredentialActions.verifyNewSecret,
      { provider: args.provider, secret: args.newSecret },
    );

    if (!verify.ok) {
      await step.runMutation(internal.media.credentialsDb._setStatus, {
        credentialId: args.credentialId,
        status: args.priorStatus,
        lastVerifyError: verify.message,
      });
      return;
    }

    const cred = await step.runQuery(internal.media.credentialsDb._findById, {
      credentialId: args.credentialId,
    });
    if (!cred) return;

    const created = await step.runAction(
      internal.integrations.secretStore._create,
      {
        value: args.newSecret,
        meta: {
          userId: cred.userId,
          projectId: cred.projectId,
          provider: args.provider,
          label: `${args.provider}-creds-rotated`,
        },
      },
    );

    const markArgs: {
      credentialId: typeof args.credentialId;
      newVaultSecretId: string;
      newVersionId?: string;
    } = {
      credentialId: args.credentialId,
      newVaultSecretId: created.id,
    };
    if (created.versionId !== undefined) {
      markArgs.newVersionId = created.versionId;
    }
    await step.runMutation(internal.media.credentialsDb._markRotated, markArgs);

    // Best-effort cleanup of the old vault entry. If this step fails the
    // workflow will retry it (orphan vault entries cost money).
    await step.runAction(internal.integrations.secretStore._delete, {
      id: cred.vaultSecretId,
    });
  },
});

/**
 * Internal mutation that starts the rotation workflow. Used by
 * `mediaCredentials.rotate` so the kick happens atomically with the
 * `status = "rotating"` patch.
 */
export const kickRotation = internalMutation({
  args: {
    credentialId: v.id("mediaCredentials"),
    provider: PROVIDER_VALIDATOR,
    newSecret: v.string(),
    priorStatus: v.union(v.literal("active"), v.literal("invalid")),
  },
  handler: async (ctx, args): Promise<string> => {
    const workflowArgs: {
      credentialId: typeof args.credentialId;
      provider: typeof args.provider;
      newSecret: string;
      priorStatus: "active" | "invalid";
    } = {
      credentialId: args.credentialId,
      provider: args.provider,
      newSecret: args.newSecret,
      priorStatus: args.priorStatus,
    };
    const workflowId = await rotateWorkflowManager.start(
      ctx,
      internal.workflows.rotateCredential.rotateCredentialWorkflow,
      workflowArgs,
    );
    return workflowId as unknown as string;
  },
});
