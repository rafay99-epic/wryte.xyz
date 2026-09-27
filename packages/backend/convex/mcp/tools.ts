import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  defineMcpAction,
  defineMcpMutation,
  defineMcpQuery,
  type McpToolRegistration,
  mcpCallerValidator,
} from "convex-mcp-gateway";
import { internal } from "../_generated/api";
import { RESEARCH_TYPE } from "./handlers/content";
import { SCOPES, type WryteToolMetadata } from "./scopes";

const READ = { scopes: [SCOPES.read] } satisfies WryteToolMetadata;
const WRITE = { scopes: [SCOPES.write] } satisfies WryteToolMetadata;
const PUBLISH = { scopes: [SCOPES.publish] } satisfies WryteToolMetadata;
const MEDIA = { scopes: [SCOPES.media] } satisfies WryteToolMetadata;

const WRITE_BODY = {
  scopes: [SCOPES.write],
  auditArgs: { redact: ["content", "frontmatter"] },
} satisfies WryteToolMetadata;

const WRITE_NO_AUDIT = {
  scopes: [SCOPES.write],
  auditArgs: false,
} satisfies WryteToolMetadata;

export const tools: McpToolRegistration[] = [
  defineMcpQuery({
    name: "wryte_projects_list",
    description:
      "List the caller's writing projects with repo, branch, content paths and media storage mode.",
    fn: internal.mcp.handlers.projects.list,
    args: { caller: mcpCallerValidator },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_list",
    description:
      "Paginated list of a project's documents (id, title, slug). Page with the returned cursor.",
    fn: internal.mcp.handlers.documents.list,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      paginationOpts: paginationOptsValidator,
    },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_search",
    description:
      "Search document titles across one project or all of them. Start here when looking for an existing post.",
    fn: internal.mcp.handlers.documents.search,
    args: {
      caller: mcpCallerValidator,
      term: v.string(),
      projectId: v.optional(v.id("projects")),
      limit: v.optional(v.number()),
    },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_get",
    description:
      "Get one document by id: frontmatter, body, tags, status, publish state.",
    fn: internal.mcp.handlers.documents.get,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_backlinks",
    description: "List documents that link to this one.",
    fn: internal.mcp.handlers.documents.backlinks,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_history",
    description: "Publish history for a document, newest first.",
    fn: internal.mcp.handlers.documents.history,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_documents_create",
    description:
      "Create a document. Read the project's frontmatter-schema resource first and pass a complete frontmatter including all required fields.",
    fn: internal.mcp.handlers.documents.create,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      title: v.string(),
      slug: v.string(),
      status: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      frontmatter: v.optional(v.string()),
      content: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_documents_update",
    description:
      "Update a document's title, slug, body, frontmatter, status or tags. Send only the fields that change.",
    fn: internal.mcp.handlers.documents.update,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      title: v.optional(v.string()),
      slug: v.optional(v.string()),
      content: v.optional(v.string()),
      frontmatter: v.optional(v.string()),
      status: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_documents_trash",
    description:
      "Move a document to the project trash. Recoverable with wryte_trash_restore.",
    fn: internal.mcp.handlers.documents.trash,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: { scopes: [SCOPES.trash] } satisfies WryteToolMetadata,
  }),

  defineMcpQuery({
    name: "wryte_drafts_list",
    description:
      "List a document's draft versions (metadata only, newest last).",
    fn: internal.mcp.handlers.drafts.list,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_drafts_get",
    description: "Get one draft with its title and body.",
    fn: internal.mcp.handlers.drafts.get,
    args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_drafts_create",
    description:
      "Create an empty draft tab for a document, optionally copying the main body (copyFromMain).",
    fn: internal.mcp.handlers.drafts.create,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      label: v.optional(v.string()),
      copyFromMain: v.optional(v.boolean()),
    },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpMutation({
    name: "wryte_drafts_snapshot",
    description:
      "Write a full draft version (label, title, body, optional frontmatter snapshot and summary) in one call. Use this to save a complete alternate version of a document.",
    fn: internal.mcp.handlers.drafts.createSnapshot,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      label: v.string(),
      title: v.string(),
      content: v.string(),
      frontmatter: v.optional(v.string()),
      summary: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_drafts_update_content",
    description: "Update a draft's title and/or body.",
    fn: internal.mcp.handlers.drafts.updateContent,
    args: {
      caller: mcpCallerValidator,
      draftId: v.id("document_drafts"),
      title: v.optional(v.string()),
      content: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_drafts_promote",
    description:
      "Promote a draft to be the document's main title, body and frontmatter.",
    fn: internal.mcp.handlers.drafts.promote,
    args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpMutation({
    name: "wryte_drafts_remove",
    description: "Delete a draft version. The main document is untouched.",
    fn: internal.mcp.handlers.drafts.remove,
    args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpQuery({
    name: "wryte_animations_list",
    description:
      "List a project's animation components (id, name, updatedAt). Fetch source with wryte_animations_get_source.",
    fn: internal.mcp.handlers.animations.list,
    args: { caller: mcpCallerValidator, projectId: v.id("projects") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_animations_get_source",
    description: "Get one animation's React source by id.",
    fn: internal.mcp.handlers.animations.getSource,
    args: { caller: mcpCallerValidator, animationId: v.id("animations") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_animations_create",
    description:
      "Create an animation component (PascalCase name + React TSX source) a post can embed as <Name />. Fails if the name exists — use wryte_animations_replace_by_name to overwrite.",
    fn: internal.mcp.handlers.animations.create,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      name: v.string(),
      source: v.string(),
    },
    identityArg: "caller",
    metadata: WRITE_NO_AUDIT,
  }),

  defineMcpMutation({
    name: "wryte_animations_update",
    description: "Replace an animation's source by id. Names are immutable.",
    fn: internal.mcp.handlers.animations.update,
    args: {
      caller: mcpCallerValidator,
      animationId: v.id("animations"),
      source: v.string(),
    },
    identityArg: "caller",
    metadata: WRITE_NO_AUDIT,
  }),

  defineMcpMutation({
    name: "wryte_animations_replace_by_name",
    description:
      "Overwrite an animation's source by project + name. Use this for repeat uploads of an existing component.",
    fn: internal.mcp.handlers.animations.replaceByName,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      name: v.string(),
      source: v.string(),
    },
    identityArg: "caller",
    metadata: WRITE_NO_AUDIT,
  }),

  defineMcpMutation({
    name: "wryte_animations_remove",
    description: "Delete an animation component.",
    fn: internal.mcp.handlers.animations.remove,
    args: { caller: mcpCallerValidator, animationId: v.id("animations") },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpQuery({
    name: "wryte_research_list",
    description: "List research notes attached to a document.",
    fn: internal.mcp.handlers.content.researchList,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_research_create",
    description:
      "File a research finding against a document (quote, link, statistic, note). Use this for research rather than writing findings into the body.",
    fn: internal.mcp.handlers.content.researchCreate,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      type: RESEARCH_TYPE,
      title: v.string(),
      content: v.string(),
      url: v.optional(v.string()),
      sourceName: v.optional(v.string()),
      selectedForAi: v.optional(v.boolean()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_research_update",
    description: "Update a research note.",
    fn: internal.mcp.handlers.content.researchUpdate,
    args: {
      caller: mcpCallerValidator,
      researchId: v.id("document_research"),
      type: v.optional(RESEARCH_TYPE),
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      url: v.optional(v.string()),
      sourceName: v.optional(v.string()),
      selectedForAi: v.optional(v.boolean()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_research_remove",
    description: "Delete a research note.",
    fn: internal.mcp.handlers.content.researchRemove,
    args: {
      caller: mcpCallerValidator,
      researchId: v.id("document_research"),
    },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpQuery({
    name: "wryte_calendar_get",
    description:
      "Editorial calendar for one project: scheduled and published dates per document.",
    fn: internal.mcp.handlers.documents.calendar,
    args: { caller: mcpCallerValidator, projectId: v.id("projects") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_schedule_set",
    description:
      "Schedule a document to publish at a UTC epoch-millisecond timestamp.",
    fn: internal.mcp.handlers.publishing.scheduleSet,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      scheduledAt: v.number(),
      socialPostText: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: PUBLISH,
  }),

  defineMcpMutation({
    name: "wryte_schedule_cancel",
    description: "Cancel a document's scheduled publish.",
    fn: internal.mcp.handlers.publishing.scheduleCancel,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: PUBLISH,
  }),

  defineMcpAction({
    name: "wryte_publish_document",
    description:
      "Commit a document to its project's GitHub repo and mark it published.",
    fn: internal.mcp.handlers.nodeActions.publish,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      commitMessage: v.optional(v.string()),
      socialPostText: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: PUBLISH,
  }),

  defineMcpAction({
    name: "wryte_media_list",
    description: "List a project's uploaded media, paginated.",
    fn: internal.mcp.handlers.nodeActions.mediaList,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      cursor: v.optional(v.string()),
      limit: v.optional(v.number()),
    },
    identityArg: "caller",
    metadata: MEDIA,
  }),

  defineMcpAction({
    name: "wryte_media_upload",
    description:
      "Upload base64 media. Destination follows the project's media storage mode (GitHub, UploadThing or Cloudinary).",
    fn: internal.mcp.handlers.nodeActions.mediaUpload,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      base64: v.string(),
      mime: v.string(),
      filename: v.string(),
      documentId: v.optional(v.id("documents")),
    },
    identityArg: "caller",
    metadata: {
      scopes: [SCOPES.media],
      auditArgs: false,
    } satisfies WryteToolMetadata,
  }),

  defineMcpQuery({
    name: "wryte_stats_get",
    description:
      "Writing stats across all projects: streak, word counts, goals, status breakdown.",
    fn: internal.mcp.handlers.publishing.stats,
    args: { caller: mcpCallerValidator },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_trash_restore",
    description: "Restore a trashed document.",
    fn: internal.mcp.handlers.publishing.trashRestore,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: WRITE,
  }),
];
