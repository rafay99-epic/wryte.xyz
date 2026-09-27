"use node";

import { WorkOS } from "@workos-inc/node";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

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

function makeWorkOSStore(): SecretStore {
  return {
    async create(value, meta) {
      const workos = buildClient();
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

export const secretStore: SecretStore = makeWorkOSStore();

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

export const _delete = internalAction({
  args: { id: v.string() },
  handler: async (_ctx, args) => {
    await secretStore.delete(args.id);
    return null;
  },
});
