/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _lib_admin from "../_lib/admin.js";
import type * as _lib_auth from "../_lib/auth.js";
import type * as _lib_compression from "../_lib/compression.js";
import type * as _lib_documentCount from "../_lib/documentCount.js";
import type * as _lib_quotas from "../_lib/quotas.js";
import type * as _lib_rateLimits from "../_lib/rateLimits.js";
import type * as _pools_import from "../_pools/import.js";
import type * as _pools_upload from "../_pools/upload.js";
import type * as _seed_changelog from "../_seed/changelog.js";
import type * as _seed_featureRequests from "../_seed/featureRequests.js";
import type * as account_selfDestruct from "../account/selfDestruct.js";
import type * as account_users from "../account/users.js";
import type * as ai_credentials from "../ai/credentials.js";
import type * as ai_credentialsDb from "../ai/credentialsDb.js";
import type * as ai_enhance from "../ai/enhance.js";
import type * as ai_enhanceActions from "../ai/enhanceActions.js";
import type * as cms_boardColumns from "../cms/boardColumns.js";
import type * as cms_changelog from "../cms/changelog.js";
import type * as cms_conflicts from "../cms/conflicts.js";
import type * as cms_documentDrafts from "../cms/documentDrafts.js";
import type * as cms_documentResearch from "../cms/documentResearch.js";
import type * as cms_documents from "../cms/documents.js";
import type * as cms_projects from "../cms/projects.js";
import type * as cms_trash from "../cms/trash.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as integrations_clerk from "../integrations/clerk.js";
import type * as integrations_github from "../integrations/github.js";
import type * as integrations_scheduling from "../integrations/scheduling.js";
import type * as integrations_secretStore from "../integrations/secretStore.js";
import type * as media_credentials from "../media/credentials.js";
import type * as media_credentialsDb from "../media/credentialsDb.js";
import type * as media_uploads from "../media/uploads.js";
import type * as media_uploadsDb from "../media/uploadsDb.js";
import type * as providers_cloudinary from "../providers/cloudinary.js";
import type * as providers_errors from "../providers/errors.js";
import type * as providers_github from "../providers/github.js";
import type * as providers_index from "../providers/index.js";
import type * as providers_shared from "../providers/shared.js";
import type * as providers_uploadthing from "../providers/uploadthing.js";
import type * as support_featureRequests from "../support/featureRequests.js";
import type * as support_tickets from "../support/tickets.js";
import type * as workflows_rotateCredential from "../workflows/rotateCredential.js";
import type * as workflows_rotateCredentialActions from "../workflows/rotateCredentialActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_lib/admin": typeof _lib_admin;
  "_lib/auth": typeof _lib_auth;
  "_lib/compression": typeof _lib_compression;
  "_lib/documentCount": typeof _lib_documentCount;
  "_lib/quotas": typeof _lib_quotas;
  "_lib/rateLimits": typeof _lib_rateLimits;
  "_pools/import": typeof _pools_import;
  "_pools/upload": typeof _pools_upload;
  "_seed/changelog": typeof _seed_changelog;
  "_seed/featureRequests": typeof _seed_featureRequests;
  "account/selfDestruct": typeof account_selfDestruct;
  "account/users": typeof account_users;
  "ai/credentials": typeof ai_credentials;
  "ai/credentialsDb": typeof ai_credentialsDb;
  "ai/enhance": typeof ai_enhance;
  "ai/enhanceActions": typeof ai_enhanceActions;
  "cms/boardColumns": typeof cms_boardColumns;
  "cms/changelog": typeof cms_changelog;
  "cms/conflicts": typeof cms_conflicts;
  "cms/documentDrafts": typeof cms_documentDrafts;
  "cms/documentResearch": typeof cms_documentResearch;
  "cms/documents": typeof cms_documents;
  "cms/projects": typeof cms_projects;
  "cms/trash": typeof cms_trash;
  crons: typeof crons;
  http: typeof http;
  "integrations/clerk": typeof integrations_clerk;
  "integrations/github": typeof integrations_github;
  "integrations/scheduling": typeof integrations_scheduling;
  "integrations/secretStore": typeof integrations_secretStore;
  "media/credentials": typeof media_credentials;
  "media/credentialsDb": typeof media_credentialsDb;
  "media/uploads": typeof media_uploads;
  "media/uploadsDb": typeof media_uploadsDb;
  "providers/cloudinary": typeof providers_cloudinary;
  "providers/errors": typeof providers_errors;
  "providers/github": typeof providers_github;
  "providers/index": typeof providers_index;
  "providers/shared": typeof providers_shared;
  "providers/uploadthing": typeof providers_uploadthing;
  "support/featureRequests": typeof support_featureRequests;
  "support/tickets": typeof support_tickets;
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
  githubImportPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"githubImportPool">;
};
