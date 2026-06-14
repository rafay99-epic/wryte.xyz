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
import type * as _lib_contentFormat from "../_lib/contentFormat.js";
import type * as _lib_dateUtils from "../_lib/dateUtils.js";
import type * as _lib_documentCount from "../_lib/documentCount.js";
import type * as _lib_frontmatter from "../_lib/frontmatter.js";
import type * as _lib_projectStats from "../_lib/projectStats.js";
import type * as _lib_quotas from "../_lib/quotas.js";
import type * as _lib_rateLimits from "../_lib/rateLimits.js";
import type * as _lib_wordCount from "../_lib/wordCount.js";
import type * as _pools_import from "../_pools/import.js";
import type * as _seed_changelog from "../_seed/changelog.js";
import type * as _seed_featureRequests from "../_seed/featureRequests.js";
import type * as _seed_writingStats from "../_seed/writingStats.js";
import type * as account_selfDestruct from "../account/selfDestruct.js";
import type * as account_users from "../account/users.js";
import type * as ai__lib_providers from "../ai/_lib/providers.js";
import type * as ai_aiStreams from "../ai/aiStreams.js";
import type * as ai_credentials from "../ai/credentials.js";
import type * as ai_credentialsDb from "../ai/credentialsDb.js";
import type * as ai_enhance from "../ai/enhance.js";
import type * as ai_enhanceActions from "../ai/enhanceActions.js";
import type * as ai_promptTemplates from "../ai/promptTemplates.js";
import type * as analytics_writingStats from "../analytics/writingStats.js";
import type * as cms__lib_documentContent from "../cms/_lib/documentContent.js";
import type * as cms_appVersion from "../cms/appVersion.js";
import type * as cms_boardColumns from "../cms/boardColumns.js";
import type * as cms_changelog from "../cms/changelog.js";
import type * as cms_conflicts from "../cms/conflicts.js";
import type * as cms_documentDrafts from "../cms/documentDrafts.js";
import type * as cms_documentResearch from "../cms/documentResearch.js";
import type * as cms_documents from "../cms/documents.js";
import type * as cms_ideas from "../cms/ideas.js";
import type * as cms_projects from "../cms/projects.js";
import type * as cms_shareLinks from "../cms/shareLinks.js";
import type * as cms_snapshots from "../cms/snapshots.js";
import type * as cms_snippets from "../cms/snippets.js";
import type * as cms_trash from "../cms/trash.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as integrations_clerk from "../integrations/clerk.js";
import type * as integrations_github from "../integrations/github.js";
import type * as integrations_linkCheck from "../integrations/linkCheck.js";
import type * as integrations_scheduling from "../integrations/scheduling.js";
import type * as integrations_secretStore from "../integrations/secretStore.js";
import type * as media_credentials from "../media/credentials.js";
import type * as media_credentialsDb from "../media/credentialsDb.js";
import type * as media_uploads from "../media/uploads.js";
import type * as media_uploadsDb from "../media/uploadsDb.js";
import type * as migrations_aiModels from "../migrations/aiModels.js";
import type * as migrations_analytics from "../migrations/analytics.js";
import type * as migrations_contentBackfill from "../migrations/contentBackfill.js";
import type * as migrations_frontmatter from "../migrations/frontmatter.js";
import type * as providers_cloudinary from "../providers/cloudinary.js";
import type * as providers_errors from "../providers/errors.js";
import type * as providers_github from "../providers/github.js";
import type * as providers_index from "../providers/index.js";
import type * as providers_shared from "../providers/shared.js";
import type * as providers_uploadthing from "../providers/uploadthing.js";
import type * as social_credentials from "../social/credentials.js";
import type * as social_credentialsDb from "../social/credentialsDb.js";
import type * as social_post from "../social/post.js";
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
  "_lib/contentFormat": typeof _lib_contentFormat;
  "_lib/dateUtils": typeof _lib_dateUtils;
  "_lib/documentCount": typeof _lib_documentCount;
  "_lib/frontmatter": typeof _lib_frontmatter;
  "_lib/projectStats": typeof _lib_projectStats;
  "_lib/quotas": typeof _lib_quotas;
  "_lib/rateLimits": typeof _lib_rateLimits;
  "_lib/wordCount": typeof _lib_wordCount;
  "_pools/import": typeof _pools_import;
  "_seed/changelog": typeof _seed_changelog;
  "_seed/featureRequests": typeof _seed_featureRequests;
  "_seed/writingStats": typeof _seed_writingStats;
  "account/selfDestruct": typeof account_selfDestruct;
  "account/users": typeof account_users;
  "ai/_lib/providers": typeof ai__lib_providers;
  "ai/aiStreams": typeof ai_aiStreams;
  "ai/credentials": typeof ai_credentials;
  "ai/credentialsDb": typeof ai_credentialsDb;
  "ai/enhance": typeof ai_enhance;
  "ai/enhanceActions": typeof ai_enhanceActions;
  "ai/promptTemplates": typeof ai_promptTemplates;
  "analytics/writingStats": typeof analytics_writingStats;
  "cms/_lib/documentContent": typeof cms__lib_documentContent;
  "cms/appVersion": typeof cms_appVersion;
  "cms/boardColumns": typeof cms_boardColumns;
  "cms/changelog": typeof cms_changelog;
  "cms/conflicts": typeof cms_conflicts;
  "cms/documentDrafts": typeof cms_documentDrafts;
  "cms/documentResearch": typeof cms_documentResearch;
  "cms/documents": typeof cms_documents;
  "cms/ideas": typeof cms_ideas;
  "cms/projects": typeof cms_projects;
  "cms/shareLinks": typeof cms_shareLinks;
  "cms/snapshots": typeof cms_snapshots;
  "cms/snippets": typeof cms_snippets;
  "cms/trash": typeof cms_trash;
  crons: typeof crons;
  http: typeof http;
  "integrations/clerk": typeof integrations_clerk;
  "integrations/github": typeof integrations_github;
  "integrations/linkCheck": typeof integrations_linkCheck;
  "integrations/scheduling": typeof integrations_scheduling;
  "integrations/secretStore": typeof integrations_secretStore;
  "media/credentials": typeof media_credentials;
  "media/credentialsDb": typeof media_credentialsDb;
  "media/uploads": typeof media_uploads;
  "media/uploadsDb": typeof media_uploadsDb;
  "migrations/aiModels": typeof migrations_aiModels;
  "migrations/analytics": typeof migrations_analytics;
  "migrations/contentBackfill": typeof migrations_contentBackfill;
  "migrations/frontmatter": typeof migrations_frontmatter;
  "providers/cloudinary": typeof providers_cloudinary;
  "providers/errors": typeof providers_errors;
  "providers/github": typeof providers_github;
  "providers/index": typeof providers_index;
  "providers/shared": typeof providers_shared;
  "providers/uploadthing": typeof providers_uploadthing;
  "social/credentials": typeof social_credentials;
  "social/credentialsDb": typeof social_credentialsDb;
  "social/post": typeof social_post;
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
  githubImportPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"githubImportPool">;
};
