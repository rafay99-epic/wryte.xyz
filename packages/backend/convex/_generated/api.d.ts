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
import type * as _lib_animationChecker_contract from "../_lib/animationChecker/contract.js";
import type * as _lib_animationChecker_environment from "../_lib/animationChecker/environment.js";
import type * as _lib_animationChecker_run from "../_lib/animationChecker/run.js";
import type * as _lib_animationChecks from "../_lib/animationChecks.js";
import type * as _lib_animationInput from "../_lib/animationInput.js";
import type * as _lib_animationTransform from "../_lib/animationTransform.js";
import type * as _lib_appUrl from "../_lib/appUrl.js";
import type * as _lib_auth from "../_lib/auth.js";
import type * as _lib_commitAttribution from "../_lib/commitAttribution.js";
import type * as _lib_compression from "../_lib/compression.js";
import type * as _lib_contentFormat from "../_lib/contentFormat.js";
import type * as _lib_contentHash from "../_lib/contentHash.js";
import type * as _lib_dateUtils from "../_lib/dateUtils.js";
import type * as _lib_docPatch from "../_lib/docPatch.js";
import type * as _lib_documentCount from "../_lib/documentCount.js";
import type * as _lib_frontmatter from "../_lib/frontmatter.js";
import type * as _lib_githubApp from "../_lib/githubApp.js";
import type * as _lib_projectStats from "../_lib/projectStats.js";
import type * as _lib_publishedUrl from "../_lib/publishedUrl.js";
import type * as _lib_quotas from "../_lib/quotas.js";
import type * as _lib_rateLimits from "../_lib/rateLimits.js";
import type * as _lib_touch from "../_lib/touch.js";
import type * as _lib_wordCount from "../_lib/wordCount.js";
import type * as _pools_import from "../_pools/import.js";
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
import type * as cms_animations from "../cms/animations.js";
import type * as cms_appVersion from "../cms/appVersion.js";
import type * as cms_boardColumns from "../cms/boardColumns.js";
import type * as cms_conflicts from "../cms/conflicts.js";
import type * as cms_documentDrafts from "../cms/documentDrafts.js";
import type * as cms_documentResearch from "../cms/documentResearch.js";
import type * as cms_documents from "../cms/documents.js";
import type * as cms_ideas from "../cms/ideas.js";
import type * as cms_notes__lib_access from "../cms/notes/_lib/access.js";
import type * as cms_notes__lib_board from "../cms/notes/_lib/board.js";
import type * as cms_notes__lib_counters from "../cms/notes/_lib/counters.js";
import type * as cms_notes__lib_groups from "../cms/notes/_lib/groups.js";
import type * as cms_notes__lib_links from "../cms/notes/_lib/links.js";
import type * as cms_notes__lib_model from "../cms/notes/_lib/model.js";
import type * as cms_notes__lib_purge from "../cms/notes/_lib/purge.js";
import type * as cms_notes__lib_read from "../cms/notes/_lib/read.js";
import type * as cms_notes__lib_refs from "../cms/notes/_lib/refs.js";
import type * as cms_notes__lib_search from "../cms/notes/_lib/search.js";
import type * as cms_notes__lib_shareModel from "../cms/notes/_lib/shareModel.js";
import type * as cms_notes__lib_shares from "../cms/notes/_lib/shares.js";
import type * as cms_notes__lib_write from "../cms/notes/_lib/write.js";
import type * as cms_notes_board from "../cms/notes/board.js";
import type * as cms_notes_calendar from "../cms/notes/calendar.js";
import type * as cms_notes_groups from "../cms/notes/groups.js";
import type * as cms_notes_links from "../cms/notes/links.js";
import type * as cms_notes_notes from "../cms/notes/notes.js";
import type * as cms_notes_refs from "../cms/notes/refs.js";
import type * as cms_notes_shares from "../cms/notes/shares.js";
import type * as cms_projects from "../cms/projects.js";
import type * as cms_shareLinks from "../cms/shareLinks.js";
import type * as cms_snapshots from "../cms/snapshots.js";
import type * as cms_snippets from "../cms/snippets.js";
import type * as cms_trash from "../cms/trash.js";
import type * as crons from "../crons.js";
import type * as deployments_targets from "../deployments/targets.js";
import type * as deployments_verify from "../deployments/verify.js";
import type * as http from "../http.js";
import type * as integrations_clerk from "../integrations/clerk.js";
import type * as integrations_github from "../integrations/github.js";
import type * as integrations_linkCheck from "../integrations/linkCheck.js";
import type * as integrations_oembed from "../integrations/oembed.js";
import type * as integrations_oembedProviders from "../integrations/oembedProviders.js";
import type * as integrations_scheduling from "../integrations/scheduling.js";
import type * as integrations_secretStore from "../integrations/secretStore.js";
import type * as maintenance_retireExternalAnalytics from "../maintenance/retireExternalAnalytics.js";
import type * as mcp_agentFunctions from "../mcp/agentFunctions.js";
import type * as mcp_agentInput from "../mcp/agentInput.js";
import type * as mcp_authorize from "../mcp/authorize.js";
import type * as mcp_documentView from "../mcp/documentView.js";
import type * as mcp_draftReport from "../mcp/draftReport.js";
import type * as mcp_frontmatterSchema from "../mcp/frontmatterSchema.js";
import type * as mcp_gate from "../mcp/gate.js";
import type * as mcp_grants from "../mcp/grants.js";
import type * as mcp_handlers_animationUpsert from "../mcp/handlers/animationUpsert.js";
import type * as mcp_handlers_animations from "../mcp/handlers/animations.js";
import type * as mcp_handlers_content from "../mcp/handlers/content.js";
import type * as mcp_handlers_documents from "../mcp/handlers/documents.js";
import type * as mcp_handlers_drafts from "../mcp/handlers/drafts.js";
import type * as mcp_handlers_media from "../mcp/handlers/media.js";
import type * as mcp_handlers_nodeActions from "../mcp/handlers/nodeActions.js";
import type * as mcp_handlers_noteShares from "../mcp/handlers/noteShares.js";
import type * as mcp_handlers_notes from "../mcp/handlers/notes.js";
import type * as mcp_handlers_projects from "../mcp/handlers/projects.js";
import type * as mcp_handlers_publishing from "../mcp/handlers/publishing.js";
import type * as mcp_handlers_resources from "../mcp/handlers/resources.js";
import type * as mcp_maintenance from "../mcp/maintenance.js";
import type * as mcp_mediaRoute from "../mcp/mediaRoute.js";
import type * as mcp_projectContext from "../mcp/projectContext.js";
import type * as mcp_resources from "../mcp/resources.js";
import type * as mcp_retry from "../mcp/retry.js";
import type * as mcp_scopes from "../mcp/scopes.js";
import type * as mcp_tools from "../mcp/tools.js";
import type * as media__lib_noteSource from "../media/_lib/noteSource.js";
import type * as media__lib_owner from "../media/_lib/owner.js";
import type * as media__lib_providers from "../media/_lib/providers.js";
import type * as media__lib_remote from "../media/_lib/remote.js";
import type * as media__lib_usage from "../media/_lib/usage.js";
import type * as media_credentials from "../media/credentials.js";
import type * as media_credentialsDb from "../media/credentialsDb.js";
import type * as media_noteMedia from "../media/noteMedia.js";
import type * as media_providerResolution from "../media/providerResolution.js";
import type * as media_uploads from "../media/uploads.js";
import type * as media_uploadsDb from "../media/uploadsDb.js";
import type * as profiles from "../profiles.js";
import type * as providers_cloudinary from "../providers/cloudinary.js";
import type * as providers_errors from "../providers/errors.js";
import type * as providers_github from "../providers/github.js";
import type * as providers_r2 from "../providers/r2.js";
import type * as providers_registry from "../providers/registry.js";
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
  "_lib/animationChecker/contract": typeof _lib_animationChecker_contract;
  "_lib/animationChecker/environment": typeof _lib_animationChecker_environment;
  "_lib/animationChecker/run": typeof _lib_animationChecker_run;
  "_lib/animationChecks": typeof _lib_animationChecks;
  "_lib/animationInput": typeof _lib_animationInput;
  "_lib/animationTransform": typeof _lib_animationTransform;
  "_lib/appUrl": typeof _lib_appUrl;
  "_lib/auth": typeof _lib_auth;
  "_lib/commitAttribution": typeof _lib_commitAttribution;
  "_lib/compression": typeof _lib_compression;
  "_lib/contentFormat": typeof _lib_contentFormat;
  "_lib/contentHash": typeof _lib_contentHash;
  "_lib/dateUtils": typeof _lib_dateUtils;
  "_lib/docPatch": typeof _lib_docPatch;
  "_lib/documentCount": typeof _lib_documentCount;
  "_lib/frontmatter": typeof _lib_frontmatter;
  "_lib/githubApp": typeof _lib_githubApp;
  "_lib/projectStats": typeof _lib_projectStats;
  "_lib/publishedUrl": typeof _lib_publishedUrl;
  "_lib/quotas": typeof _lib_quotas;
  "_lib/rateLimits": typeof _lib_rateLimits;
  "_lib/touch": typeof _lib_touch;
  "_lib/wordCount": typeof _lib_wordCount;
  "_pools/import": typeof _pools_import;
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
  "cms/animations": typeof cms_animations;
  "cms/appVersion": typeof cms_appVersion;
  "cms/boardColumns": typeof cms_boardColumns;
  "cms/conflicts": typeof cms_conflicts;
  "cms/documentDrafts": typeof cms_documentDrafts;
  "cms/documentResearch": typeof cms_documentResearch;
  "cms/documents": typeof cms_documents;
  "cms/ideas": typeof cms_ideas;
  "cms/notes/_lib/access": typeof cms_notes__lib_access;
  "cms/notes/_lib/board": typeof cms_notes__lib_board;
  "cms/notes/_lib/counters": typeof cms_notes__lib_counters;
  "cms/notes/_lib/groups": typeof cms_notes__lib_groups;
  "cms/notes/_lib/links": typeof cms_notes__lib_links;
  "cms/notes/_lib/model": typeof cms_notes__lib_model;
  "cms/notes/_lib/purge": typeof cms_notes__lib_purge;
  "cms/notes/_lib/read": typeof cms_notes__lib_read;
  "cms/notes/_lib/refs": typeof cms_notes__lib_refs;
  "cms/notes/_lib/search": typeof cms_notes__lib_search;
  "cms/notes/_lib/shareModel": typeof cms_notes__lib_shareModel;
  "cms/notes/_lib/shares": typeof cms_notes__lib_shares;
  "cms/notes/_lib/write": typeof cms_notes__lib_write;
  "cms/notes/board": typeof cms_notes_board;
  "cms/notes/calendar": typeof cms_notes_calendar;
  "cms/notes/groups": typeof cms_notes_groups;
  "cms/notes/links": typeof cms_notes_links;
  "cms/notes/notes": typeof cms_notes_notes;
  "cms/notes/refs": typeof cms_notes_refs;
  "cms/notes/shares": typeof cms_notes_shares;
  "cms/projects": typeof cms_projects;
  "cms/shareLinks": typeof cms_shareLinks;
  "cms/snapshots": typeof cms_snapshots;
  "cms/snippets": typeof cms_snippets;
  "cms/trash": typeof cms_trash;
  crons: typeof crons;
  "deployments/targets": typeof deployments_targets;
  "deployments/verify": typeof deployments_verify;
  http: typeof http;
  "integrations/clerk": typeof integrations_clerk;
  "integrations/github": typeof integrations_github;
  "integrations/linkCheck": typeof integrations_linkCheck;
  "integrations/oembed": typeof integrations_oembed;
  "integrations/oembedProviders": typeof integrations_oembedProviders;
  "integrations/scheduling": typeof integrations_scheduling;
  "integrations/secretStore": typeof integrations_secretStore;
  "maintenance/retireExternalAnalytics": typeof maintenance_retireExternalAnalytics;
  "mcp/agentFunctions": typeof mcp_agentFunctions;
  "mcp/agentInput": typeof mcp_agentInput;
  "mcp/authorize": typeof mcp_authorize;
  "mcp/documentView": typeof mcp_documentView;
  "mcp/draftReport": typeof mcp_draftReport;
  "mcp/frontmatterSchema": typeof mcp_frontmatterSchema;
  "mcp/gate": typeof mcp_gate;
  "mcp/grants": typeof mcp_grants;
  "mcp/handlers/animationUpsert": typeof mcp_handlers_animationUpsert;
  "mcp/handlers/animations": typeof mcp_handlers_animations;
  "mcp/handlers/content": typeof mcp_handlers_content;
  "mcp/handlers/documents": typeof mcp_handlers_documents;
  "mcp/handlers/drafts": typeof mcp_handlers_drafts;
  "mcp/handlers/media": typeof mcp_handlers_media;
  "mcp/handlers/nodeActions": typeof mcp_handlers_nodeActions;
  "mcp/handlers/noteShares": typeof mcp_handlers_noteShares;
  "mcp/handlers/notes": typeof mcp_handlers_notes;
  "mcp/handlers/projects": typeof mcp_handlers_projects;
  "mcp/handlers/publishing": typeof mcp_handlers_publishing;
  "mcp/handlers/resources": typeof mcp_handlers_resources;
  "mcp/maintenance": typeof mcp_maintenance;
  "mcp/mediaRoute": typeof mcp_mediaRoute;
  "mcp/projectContext": typeof mcp_projectContext;
  "mcp/resources": typeof mcp_resources;
  "mcp/retry": typeof mcp_retry;
  "mcp/scopes": typeof mcp_scopes;
  "mcp/tools": typeof mcp_tools;
  "media/_lib/noteSource": typeof media__lib_noteSource;
  "media/_lib/owner": typeof media__lib_owner;
  "media/_lib/providers": typeof media__lib_providers;
  "media/_lib/remote": typeof media__lib_remote;
  "media/_lib/usage": typeof media__lib_usage;
  "media/credentials": typeof media_credentials;
  "media/credentialsDb": typeof media_credentialsDb;
  "media/noteMedia": typeof media_noteMedia;
  "media/providerResolution": typeof media_providerResolution;
  "media/uploads": typeof media_uploads;
  "media/uploadsDb": typeof media_uploadsDb;
  profiles: typeof profiles;
  "providers/cloudinary": typeof providers_cloudinary;
  "providers/errors": typeof providers_errors;
  "providers/github": typeof providers_github;
  "providers/r2": typeof providers_r2;
  "providers/registry": typeof providers_registry;
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
  mcpGateway: import("convex-mcp-gateway/_generated/component.js").ComponentApi<"mcpGateway">;
};
