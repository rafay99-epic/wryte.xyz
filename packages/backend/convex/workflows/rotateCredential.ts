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

export const rotateCredentialWorkflow = rotateWorkflowManager.define({
  args: {
    credentialId: v.id("mediaCredentials"),
    provider: PROVIDER_VALIDATOR,
    newVaultSecretId: v.string(),
    newVersionId: v.optional(v.string()),
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

    await step.runAction(internal.integrations.secretStore._delete, {
      id: cred.vaultSecretId,
    });
  },
});

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
