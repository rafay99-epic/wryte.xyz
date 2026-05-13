/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiCredentials from "../aiCredentials.js";
import type * as aiCredentialsDb from "../aiCredentialsDb.js";
import type * as ai_actions from "../ai_actions.js";
import type * as auth_helpers from "../auth_helpers.js";
import type * as boardColumns from "../boardColumns.js";
import type * as crons from "../crons.js";
import type * as documents from "../documents.js";
import type * as github from "../github.js";
import type * as http from "../http.js";
import type * as media from "../media.js";
import type * as mediaCredentials from "../mediaCredentials.js";
import type * as mediaCredentialsDb from "../mediaCredentialsDb.js";
import type * as mediaDb from "../mediaDb.js";
import type * as projects from "../projects.js";
import type * as providers_cloudinary from "../providers/cloudinary.js";
import type * as providers_errors from "../providers/errors.js";
import type * as providers_github from "../providers/github.js";
import type * as providers_index from "../providers/index.js";
import type * as providers_shared from "../providers/shared.js";
import type * as providers_uploadthing from "../providers/uploadthing.js";
import type * as quotas from "../quotas.js";
import type * as rateLimits from "../rateLimits.js";
import type * as scheduling from "../scheduling.js";
import type * as secretStore from "../secretStore.js";
import type * as selfDestruct from "../selfDestruct.js";
import type * as uploadPool from "../uploadPool.js";
import type * as users from "../users.js";
import type * as workflows_rotateCredential from "../workflows/rotateCredential.js";
import type * as workflows_rotateCredentialActions from "../workflows/rotateCredentialActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiCredentials: typeof aiCredentials;
  aiCredentialsDb: typeof aiCredentialsDb;
  ai_actions: typeof ai_actions;
  auth_helpers: typeof auth_helpers;
  boardColumns: typeof boardColumns;
  crons: typeof crons;
  documents: typeof documents;
  github: typeof github;
  http: typeof http;
  media: typeof media;
  mediaCredentials: typeof mediaCredentials;
  mediaCredentialsDb: typeof mediaCredentialsDb;
  mediaDb: typeof mediaDb;
  projects: typeof projects;
  "providers/cloudinary": typeof providers_cloudinary;
  "providers/errors": typeof providers_errors;
  "providers/github": typeof providers_github;
  "providers/index": typeof providers_index;
  "providers/shared": typeof providers_shared;
  "providers/uploadthing": typeof providers_uploadthing;
  quotas: typeof quotas;
  rateLimits: typeof rateLimits;
  scheduling: typeof scheduling;
  secretStore: typeof secretStore;
  selfDestruct: typeof selfDestruct;
  uploadPool: typeof uploadPool;
  users: typeof users;
  "workflows/rotateCredential": typeof workflows_rotateCredential;
  "workflows/rotateCredentialActions": typeof workflows_rotateCredentialActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  workflow: import("@convex-dev/workflow/_generated/component.js").ComponentApi<"workflow">;
  persistentTextStreaming: import("@convex-dev/persistent-text-streaming/_generated/component.js").ComponentApi<"persistentTextStreaming">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  mediaUploadPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"mediaUploadPool">;
  mediaMaintenancePool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"mediaMaintenancePool">;
};
