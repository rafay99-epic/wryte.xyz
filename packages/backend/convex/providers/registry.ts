"use node";

import type {
  MediaProvider,
  NormalizedMediaItem,
} from "../media/_lib/providers";
import * as cloudinary from "./cloudinary";
import {
  type MediaErrorCode,
  mapCloudinaryError,
  mapGithubError,
  mapR2Error,
  mapUploadThingError,
  throwMediaError,
} from "./errors";
import * as github from "./github";
import * as r2 from "./r2";
import {
  normalizeKeyPrefix,
  parseCloudinarySecret,
  parseR2Secret,
} from "./shared";
import * as uploadthing from "./uploadthing";

export type ProjectMediaConfig = {
  slug: string;
  mediaPath?: string | undefined;
  githubRepo?: string | undefined;
  githubBranch?: string | undefined;
};

export type ProviderContext = {
  project: ProjectMediaConfig;
  secret: string;
};

export type AdapterUploadInput = {
  buffer: Buffer;
  mime: string;
  filename: string;
};

export type AdapterUploadResult = {
  url: string;
  externalId: string;
  bytes: number;
  width?: number;
  height?: number;
};

export type AdapterListInput = {
  cursor?: string | undefined;
  limit: number;
};

export type AdapterListResult = {
  items: NormalizedMediaItem[];
  nextCursor: string | null;
};

export type AdapterDeleteRef = {
  externalId: string;
  sha?: string | undefined;
};

export type ProviderAdapter = {
  readonly id: MediaProvider;
  validateSecret(raw: string): void;
  ping(secret: string): Promise<void>;
  upload(
    cx: ProviderContext,
    file: AdapterUploadInput,
  ): Promise<AdapterUploadResult>;
  list(cx: ProviderContext, opts: AdapterListInput): Promise<AdapterListResult>;
  remove(cx: ProviderContext, ref: AdapterDeleteRef): Promise<void>;
  mapError(err: unknown): MediaErrorCode;
};

function destinationPrefix(project: ProjectMediaConfig): string {
  return normalizeKeyPrefix(project.mediaPath ?? project.slug);
}

function githubSpec(project: ProjectMediaConfig): github.GhRepoSpec {
  if (!project.githubRepo) {
    throwMediaError({
      code: "AUTH_INVALID",
      message:
        "This project has no GitHub repo configured. Add one in settings before uploading.",
      provider: "github",
    });
  }
  const { owner, repo } = github.parseRepoString(project.githubRepo);
  return {
    owner,
    repo,
    branch: project.githubBranch ?? "main",
    mediaPath: project.mediaPath ?? "public/images",
  };
}

const githubAdapter: ProviderAdapter = {
  id: "github",
  validateSecret() {},
  ping() {
    return Promise.reject(
      new Error(
        "GitHub media uses the account's OAuth connection; there is no credential to verify here.",
      ),
    );
  },
  async upload(cx, file) {
    const res = await github.uploadOne(cx.secret, githubSpec(cx.project), file);
    return {
      url: res.url,
      externalId: res.externalId,
      bytes: res.bytes,
    };
  },
  async list(cx) {
    const items = await github.listFiles(cx.secret, githubSpec(cx.project));
    return {
      items: items.map((item) => ({
        externalId: item.externalId,
        filename: item.filename,
        size: item.size,
        url: item.url,
        sha: item.sha,
      })),
      nextCursor: null,
    };
  },
  async remove(cx, ref) {
    const spec = githubSpec(cx.project);
    let sha = ref.sha;
    if (!sha) {
      const items = await github.listFiles(cx.secret, spec);
      sha = items.find((item) => item.externalId === ref.externalId)?.sha;
      if (!sha) return;
    }
    await github.deleteFile(cx.secret, spec, ref.externalId, sha);
  },
  mapError: mapGithubError,
};

const uploadthingAdapter: ProviderAdapter = {
  id: "uploadthing",
  validateSecret(raw) {
    if (raw.trim() === "") {
      throw new Error("UPLOADTHING_TOKEN must not be empty");
    }
  },
  ping: uploadthing.ping,
  async upload(cx, file) {
    const res = await uploadthing.uploadOne(cx.secret, {
      buffer: file.buffer,
      name: file.filename,
      mime: file.mime,
    });
    return { url: res.url, externalId: res.externalId, bytes: res.bytes };
  },
  async list(cx, opts) {
    const offset = opts.cursor ? Number(opts.cursor) : 0;
    const { items, hasMore } = await uploadthing.listFiles(cx.secret, {
      limit: opts.limit,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    const usable = items.filter(
      (item): item is typeof item & { url: string } =>
        typeof item.url === "string" && item.url.length > 0,
    );
    return {
      items: usable.map((item) => ({
        externalId: item.externalId,
        filename: item.filename,
        size: item.size,
        url: item.url,
      })),
      nextCursor: hasMore ? String(offset + items.length) : null,
    };
  },
  async remove(cx, ref) {
    await uploadthing.deleteFiles(cx.secret, [ref.externalId]);
  },
  mapError: mapUploadThingError,
};

const cloudinaryAdapter: ProviderAdapter = {
  id: "cloudinary",
  validateSecret(raw) {
    parseCloudinarySecret(raw);
  },
  async ping(secret) {
    await cloudinary.ping(parseCloudinarySecret(secret));
  },
  async upload(cx, file) {
    const folder = destinationPrefix(cx.project);
    const res = await cloudinary.uploadOne(
      parseCloudinarySecret(cx.secret),
      file,
      folder ? { folder } : {},
    );
    const out: AdapterUploadResult = {
      url: res.url,
      externalId: res.externalId,
      bytes: res.bytes,
    };
    if (res.width !== undefined) out.width = res.width;
    if (res.height !== undefined) out.height = res.height;
    return out;
  },
  async list(cx, opts) {
    const folder = destinationPrefix(cx.project);
    const { items, nextCursor } = await cloudinary.listResources(
      parseCloudinarySecret(cx.secret),
      {
        max: opts.limit,
        ...(folder ? { folder } : {}),
        ...(opts.cursor ? { nextCursor: opts.cursor } : {}),
      },
    );
    return {
      items: items.map((item) => {
        const out: NormalizedMediaItem = {
          externalId: item.externalId,
          filename: item.filename,
          size: item.size,
          url: item.url,
        };
        if (item.width !== undefined) out.width = item.width;
        if (item.height !== undefined) out.height = item.height;
        return out;
      }),
      nextCursor: nextCursor ?? null,
    };
  },
  async remove(cx, ref) {
    await cloudinary.destroy(parseCloudinarySecret(cx.secret), ref.externalId);
  },
  mapError: mapCloudinaryError,
};

const r2Adapter: ProviderAdapter = {
  id: "r2",
  validateSecret(raw) {
    parseR2Secret(raw);
  },
  async ping(secret) {
    await r2.ping(parseR2Secret(secret));
  },
  async upload(cx, file) {
    const prefix = destinationPrefix(cx.project);
    const res = await r2.uploadOne(
      parseR2Secret(cx.secret),
      file,
      prefix ? { prefix } : {},
    );
    return { url: res.url, externalId: res.externalId, bytes: res.bytes };
  },
  async list(cx, opts) {
    const prefix = destinationPrefix(cx.project);
    const { items, nextCursor } = await r2.listObjects(
      parseR2Secret(cx.secret),
      {
        max: opts.limit,
        ...(prefix ? { prefix } : {}),
        ...(opts.cursor ? { continuationToken: opts.cursor } : {}),
      },
    );
    return {
      items: items.map((item) => ({
        externalId: item.externalId,
        filename: item.filename,
        size: item.size,
        url: item.url,
      })),
      nextCursor,
    };
  },
  async remove(cx, ref) {
    await r2.deleteObject(parseR2Secret(cx.secret), ref.externalId);
  },
  mapError: mapR2Error,
};

export const ADAPTERS: Record<MediaProvider, ProviderAdapter> = {
  github: githubAdapter,
  uploadthing: uploadthingAdapter,
  cloudinary: cloudinaryAdapter,
  r2: r2Adapter,
};

export function getAdapter(id: MediaProvider): ProviderAdapter {
  return ADAPTERS[id];
}

export { parseRepoString } from "./github";
