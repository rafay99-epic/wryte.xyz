/**
 * Secret store — encrypted credential storage behind a swappable interface.
 *
 * The default impl wraps WorkOS Vault. The interface is intentionally narrow
 * (create / read / update / delete) so a future swap to AWS Secrets Manager,
 * GCP Secret Manager, or an in-house AES-GCM/KMS impl is a localized change.
 *
 * Vault operations run in Node-only Convex actions because the WorkOS SDK
 * uses Node crypto primitives.
 */
"use node";

import { WorkOS } from "@workos-inc/node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

/** Metadata attached to every stored secret. Visible in WorkOS audit logs. */
export interface SecretMeta {
  userId: string;
  projectId?: string;
  provider?: string;
  label: string;
}

export interface SecretStore {
  create(
    value: string,
    meta: SecretMeta,
  ): Promise<{ id: string; versionId?: string }>;
  read(id: string): Promise<string>;
  update(
    id: string,
    value: string,
    versionCheck?: string,
  ): Promise<{ versionId?: string }>;
  delete(id: string): Promise<void>;
}

function buildClient(): WorkOS {
  const apiKey = process.env["WORKOS_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "WORKOS_API_KEY is not configured. Run `npx convex env set WORKOS_API_KEY=...` to enable vault-backed secrets.",
    );
  }
  return new WorkOS(apiKey);
}

/**
 * WorkOS Vault implementation. Each vault object holds one secret value with
 * a name + free-form context (used here for {userId, projectId, provider}).
 */
function makeWorkOSStore(): SecretStore {
  return {
    async create(value, meta) {
      const workos = buildClient();
      // Names must be unique inside the WorkOS environment; append a random
      // suffix so the same project/provider can rotate without conflict.
      const suffix = Math.random().toString(36).slice(2, 10);
      const name = `wryte/${meta.label}/${suffix}`;
      const res = await workos.vault.createObject({
        name,
        value,
        context: {
          userId: meta.userId,
          projectId: meta.projectId ?? "",
          provider: meta.provider ?? "",
        },
      });
      // @workos-inc/node v10 widened versionId to include null — omit the
      // key entirely when absent (exactOptionalPropertyTypes).
      return {
        id: res.id,
        ...(res.versionId != null ? { versionId: res.versionId } : {}),
      };
    },

    async read(id) {
      const workos = buildClient();
      const obj = await workos.vault.readObject({ id });
      if (!obj.value) {
        throw new Error(`Vault object ${id} has no readable value`);
      }
      return obj.value;
    },

    async update(id, value, versionCheck) {
      const workos = buildClient();
      const opts: { id: string; value: string; versionCheck?: string } = {
        id,
        value,
      };
      if (versionCheck !== undefined) opts.versionCheck = versionCheck;
      const res = await workos.vault.updateObject(opts);
      const versionId = res.metadata?.versionId;
      return versionId != null ? { versionId } : {};
    },

    async delete(id) {
      const workos = buildClient();
      await workos.vault.deleteObject({ id });
    },
  };
}

/** Singleton — the rest of the codebase imports this directly. */
export const secretStore: SecretStore = makeWorkOSStore();

/* ------------------------------------------------------------------ */
/*  Internal action wrappers — so other Convex modules can use the    */
/*  vault from outside Node-only files.                                */
/* ------------------------------------------------------------------ */

export const _create = internalAction({
  args: {
    value: v.string(),
    meta: v.object({
      userId: v.string(),
      projectId: v.optional(v.string()),
      provider: v.optional(v.string()),
      label: v.string(),
    }),
  },
  handler: async (_ctx, args) => {
    return await secretStore.create(args.value, args.meta);
  },
});

export const _read = internalAction({
  args: { id: v.string() },
  handler: async (_ctx, args) => {
    return await secretStore.read(args.id);
  },
});

export const _update = internalAction({
  args: {
    id: v.string(),
    value: v.string(),
    versionCheck: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    return await secretStore.update(args.id, args.value, args.versionCheck);
  },
});

export const _delete = internalAction({
  args: { id: v.string() },
  handler: async (_ctx, args) => {
    await secretStore.delete(args.id);
    return null;
  },
});
