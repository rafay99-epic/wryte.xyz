/**
 * Credential rotation workflow.
 *
 * The "verify new key → swap pointer → delete old vault entry" sequence is
 * crash-safe: if the deploy restarts after the swap succeeded, the old-entry
 * delete runs automatically on resume. If verification fails, we surface the
 * error, drop the new vault entry, and keep the old one intact — the user can
 * retry with a fresh key.
 *
 * The caller (`media/credentials.rotate`) stores the new secret in the vault
 * before starting the workflow, so only its vault id is journaled as a
 * workflow argument — the plaintext never is.
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
 * Sequenced rotation (the new secret is already in the vault):
 *   1. ping the new secret with the active provider — on failure, revert
 *      the status and delete the new vault entry
 *   2. swap the row's `vaultSecretId` and mark `active`
 *   3. delete the old vault entry
 */
export const rotateCredentialWorkflow = rotateWorkflowManager.define({
  args: {
    credentialId: v.id("mediaCredentials"),
    provider: PROVIDER_VALIDATOR,
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
    // Status to revert to if verification fails. Without this, a failed
    // rotation of an `"invalid"` row was incorrectly promoting it to
    // `"active"`.
    priorStatus: v.union(v.literal("active"), v.literal("invalid")),
  },
  handler: async (step, args) => {
    const verify = await step.runAction(
      internal.workflows.rotateCredentialActions.verifyNewSecret,
      { provider: args.provider, vaultSecretId: args.newVaultSecretId },
    );

    if (!verify.ok) {
      await step.runMutation(internal.media.credentialsDb._setStatus, {
        credentialId: args.credentialId,
        status: args.priorStatus,
        lastVerifyError: verify.message,
      });
      await step.runAction(internal.integrations.secretStore._delete, {
        id: args.newVaultSecretId,
      });
      return;
    }

    const cred = await step.runQuery(internal.media.credentialsDb._findById, {
      credentialId: args.credentialId,
    });
    if (!cred) {
      // Credential deleted mid-rotation; don't leave the new entry orphaned.
      await step.runAction(internal.integrations.secretStore._delete, {
        id: args.newVaultSecretId,
      });
      return;
    }

    const markArgs: {
      credentialId: typeof args.credentialId;
      newVaultSecretId: string;
      newVersionId?: string;
    } = {
      credentialId: args.credentialId,
      newVaultSecretId: args.newVaultSecretId,
    };
    if (args.newVersionId !== undefined) {
      markArgs.newVersionId = args.newVersionId;
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
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
    priorStatus: v.union(v.literal("active"), v.literal("invalid")),
  },
  handler: async (ctx, args): Promise<string> =>
    await rotateWorkflowManager.start(
      ctx,
      internal.workflows.rotateCredential.rotateCredentialWorkflow,
      args,
    ),
});
