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
import type * as _lib_commitAttribution from "../_lib/commitAttribution.js";
import type * as _lib_compression from "../_lib/compression.js";
import type * as _lib_contentFormat from "../_lib/contentFormat.js";
import type * as _lib_contentHash from "../_lib/contentHash.js";
import type * as _lib_dateUtils from "../_lib/dateUtils.js";
import type * as _lib_documentCount from "../_lib/documentCount.js";
import type * as _lib_frontmatter from "../_lib/frontmatter.js";
import type * as _lib_githubApp from "../_lib/githubApp.js";
import type * as _lib_projectStats from "../_lib/projectStats.js";
import type * as _lib_publishedUrl from "../_lib/publishedUrl.js";
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
import type * as cms__lib_documentLinks from "../cms/_lib/documentLinks.js";
import type * as cms__lib_draftContent from "../cms/_lib/draftContent.js";
import type * as cms__lib_purgeDocumentArtifacts from "../cms/_lib/purgeDocumentArtifacts.js";
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
import type * as deployments_targets from "../deployments/targets.js";
import type * as deployments_verify from "../deployments/verify.js";
import type * as http from "../http.js";
import type * as insights__lib_providers from "../insights/_lib/providers.js";
import type * as insights_plausible from "../insights/plausible.js";
import type * as insights_snapshots from "../insights/snapshots.js";
import type * as insights_targets from "../insights/targets.js";
import type * as insights_umami from "../insights/umami.js";
import type * as integrations_clerk from "../integrations/clerk.js";
import type * as integrations_github from "../integrations/github.js";
import type * as integrations_linkCheck from "../integrations/linkCheck.js";
import type * as integrations_oembed from "../integrations/oembed.js";
import type * as integrations_oembedProviders from "../integrations/oembedProviders.js";
import type * as integrations_scheduling from "../integrations/scheduling.js";
import type * as integrations_secretStore from "../integrations/secretStore.js";
import type * as media_credentials from "../media/credentials.js";
import type * as media_credentialsDb from "../media/credentialsDb.js";
import type * as media_uploads from "../media/uploads.js";
import type * as media_uploadsDb from "../media/uploadsDb.js";
import type * as newsletter__lib_providers from "../newsletter/_lib/providers.js";
import type * as newsletter_brevo from "../newsletter/brevo.js";
import type * as newsletter_connections from "../newsletter/connections.js";
import type * as newsletter_newsletters from "../newsletter/newsletters.js";
import type * as newsletter_render from "../newsletter/render.js";
import type * as newsletter_send from "../newsletter/send.js";
import type * as profiles from "../profiles.js";
import type * as providers_cloudinary from "../providers/cloudinary.js";
import type * as providers_errors from "../providers/errors.js";
import type * as providers_github from "../providers/github.js";
import type * as providers_index from "../providers/index.js";
import type * as providers_shared from "../providers/shared.js";
import type * as providers_uploadthing from "../providers/uploadthing.js";
import type * as social_buffer from "../social/buffer.js";
import type * as social_credentials from "../social/credentials.js";
import type * as social_credentialsDb from "../social/credentialsDb.js";
import type * as social_post from "../social/post.js";
import type * as social_postsDb from "../social/postsDb.js";
import type * as support_featureRequests from "../support/featureRequests.js";
import type * as support_tickets from "../support/tickets.js";
import type * as syndication__lib_providers from "../syndication/_lib/providers.js";
import type * as syndication_credentials from "../syndication/credentials.js";
import type * as syndication_credentialsDb from "../syndication/credentialsDb.js";
import type * as syndication_devto from "../syndication/devto.js";
import type * as syndication_errors from "../syndication/errors.js";
import type * as syndication_hashnode from "../syndication/hashnode.js";
import type * as syndication_post from "../syndication/post.js";
import type * as syndication_postsDb from "../syndication/postsDb.js";
import type * as syndication_transform from "../syndication/transform.js";
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
  "_lib/commitAttribution": typeof _lib_commitAttribution;
  "_lib/compression": typeof _lib_compression;
  "_lib/contentFormat": typeof _lib_contentFormat;
  "_lib/contentHash": typeof _lib_contentHash;
  "_lib/dateUtils": typeof _lib_dateUtils;
  "_lib/documentCount": typeof _lib_documentCount;
  "_lib/frontmatter": typeof _lib_frontmatter;
  "_lib/githubApp": typeof _lib_githubApp;
  "_lib/projectStats": typeof _lib_projectStats;
  "_lib/publishedUrl": typeof _lib_publishedUrl;
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
  "cms/_lib/documentLinks": typeof cms__lib_documentLinks;
  "cms/_lib/draftContent": typeof cms__lib_draftContent;
  "cms/_lib/purgeDocumentArtifacts": typeof cms__lib_purgeDocumentArtifacts;
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
  "deployments/targets": typeof deployments_targets;
  "deployments/verify": typeof deployments_verify;
  http: typeof http;
  "insights/_lib/providers": typeof insights__lib_providers;
  "insights/plausible": typeof insights_plausible;
  "insights/snapshots": typeof insights_snapshots;
  "insights/targets": typeof insights_targets;
  "insights/umami": typeof insights_umami;
  "integrations/clerk": typeof integrations_clerk;
  "integrations/github": typeof integrations_github;
  "integrations/linkCheck": typeof integrations_linkCheck;
  "integrations/oembed": typeof integrations_oembed;
  "integrations/oembedProviders": typeof integrations_oembedProviders;
  "integrations/scheduling": typeof integrations_scheduling;
  "integrations/secretStore": typeof integrations_secretStore;
  "media/credentials": typeof media_credentials;
  "media/credentialsDb": typeof media_credentialsDb;
  "media/uploads": typeof media_uploads;
  "media/uploadsDb": typeof media_uploadsDb;
  "newsletter/_lib/providers": typeof newsletter__lib_providers;
  "newsletter/brevo": typeof newsletter_brevo;
  "newsletter/connections": typeof newsletter_connections;
  "newsletter/newsletters": typeof newsletter_newsletters;
  "newsletter/render": typeof newsletter_render;
  "newsletter/send": typeof newsletter_send;
  profiles: typeof profiles;
  "providers/cloudinary": typeof providers_cloudinary;
  "providers/errors": typeof providers_errors;
  "providers/github": typeof providers_github;
  "providers/index": typeof providers_index;
  "providers/shared": typeof providers_shared;
  "providers/uploadthing": typeof providers_uploadthing;
  "social/buffer": typeof social_buffer;
  "social/credentials": typeof social_credentials;
  "social/credentialsDb": typeof social_credentialsDb;
  "social/post": typeof social_post;
  "social/postsDb": typeof social_postsDb;
  "support/featureRequests": typeof support_featureRequests;
  "support/tickets": typeof support_tickets;
  "syndication/_lib/providers": typeof syndication__lib_providers;
  "syndication/credentials": typeof syndication_credentials;
  "syndication/credentialsDb": typeof syndication_credentialsDb;
  "syndication/devto": typeof syndication_devto;
  "syndication/errors": typeof syndication_errors;
  "syndication/hashnode": typeof syndication_hashnode;
  "syndication/post": typeof syndication_post;
  "syndication/postsDb": typeof syndication_postsDb;
  "syndication/transform": typeof syndication_transform;
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
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
  persistentTextStreaming: import("@convex-dev/persistent-text-streaming/_generated/component.js").ComponentApi<"persistentTextStreaming">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  githubImportPool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"githubImportPool">;
};
