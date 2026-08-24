/**
 * The MCP tool catalog.
 *
 * Every entry is a declaration over a Convex function that already exists and
 * is already used by the web app. Nothing here contains business logic, and
 * nothing here re-implements an ownership check — the wrapped function calls
 * `getCurrentUser(ctx)` / `getAuthedUserOrNull(ctx)` exactly as it does for a
 * browser request, because Convex validates the MCP client's Bearer token
 * before the function runs. That is the whole reason the catalog is this thin.
 *
 * ## Three rules for adding a tool
 *
 * 1. **Descriptions are one line.** Every description is in the model's
 *    context on every turn. Shape knowledge belongs in `resources.ts` and the
 *    `initializeInstructions` string, not repeated 35 times here.
 *
 * 2. **Never wrap a query written for a reactive UI subscription.** Those
 *    return everything (`cms/documents.list` takes up to 500 rows *with*
 *    excerpts, ~200 KB). Convex bills egress and database reads, and an agent
 *    in a loop is the traffic shape that turns that into a real invoice —
 *    roughly 25x the cost of a paginated equivalent. Prefer the lean,
 *    paginated variants; `cms/documents.listForLink` already exists and is
 *    exactly the right shape.
 *
 * 3. **Set `auditArgs` on anything carrying content.** The gateway stores
 *    caller args verbatim by default, so a tool taking a document body would
 *    write that body twice — once to `document_content`, once to the audit
 *    log — and keep the copy. Redact the payload, keep the metadata.
 */
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
import { SCOPES, type WryteToolMetadata } from "./scopes";

/** Typed metadata helper — keeps every declaration honest about its scope. */
const meta = (m: WryteToolMetadata): WryteToolMetadata => m;

const READ = meta({ scopes: [SCOPES.read] });
const WRITE = meta({ scopes: [SCOPES.write] });
const PUBLISH = meta({ scopes: [SCOPES.publish] });
const MEDIA = meta({ scopes: [SCOPES.media] });

/** Write tool whose args carry document/research prose. */
const WRITE_BODY = meta({
  scopes: [SCOPES.write],
  auditArgs: { redact: ["content", "frontmatter"] },
});

/**
 * Mirrors `researchTypeValidator` in `cms/documentResearch.ts`. Declared here
 * rather than imported because that one is module-private; the compile-time
 * `args` check against the target function catches any drift immediately.
 */
const RESEARCH_TYPE = v.union(
  v.literal("note"),
  v.literal("source"),
  v.literal("quote"),
  v.literal("outline"),
  v.literal("idea"),
  v.literal("ai_summary"),
);

/**
 * The explicit `McpToolRegistration[]` annotation is required, not stylistic.
 *
 * Convex's codegen types `api` from *every* module under `convex/`, this one
 * included. So `api`'s type depends on this file, and this file imports `api`
 * — a circular type reference. Without an annotation TypeScript can't resolve
 * `tools` without evaluating `api`, gives up, infers `any`, and the collapse
 * cascades into hundreds of spurious errors in unrelated modules.
 *
 * Annotating the export breaks the cycle: `tools`'s type is now known without
 * evaluating the initializer. The per-tool compile-time checks are unaffected —
 * each `defineMcp*` call still validates its `args` against the real signature
 * of `fn`, which is where the safety actually lives.
 */
export const tools: McpToolRegistration[] = [
  /* ---------------------------------------------------------------- */
  /*  Projects                                                         */
  /* ---------------------------------------------------------------- */

  defineMcpQuery({
    name: "wryte_projects_list",
    description:
      "List the caller's writing projects with repo, branch, content paths and media storage mode.",
    fn: internal.mcp.handlers.projects.list,
    args: { caller: mcpCallerValidator },
    identityArg: "caller",
    metadata: READ,
  }),

  /* ---------------------------------------------------------------- */
  /*  Documents — read                                                 */
  /* ---------------------------------------------------------------- */

  defineMcpQuery({
    name: "wryte_documents_list",
    description:
      "Paginated list of a project's documents (id, title, slug). Page with the returned cursor.",
    // Lean + paginated by design. Deliberately NOT `documents.list`, which
    // returns up to 500 rows with excerpts for a reactive UI subscription.
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

  /* ---------------------------------------------------------------- */
  /*  Documents — write                                                */
  /* ---------------------------------------------------------------- */

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
    // Soft delete is the only deletion an agent can perform. `permanentDelete`
    // and `emptyTrash` are absent from this catalog on purpose.
    metadata: meta({ scopes: [SCOPES.trash] }),
  }),

  /* ---------------------------------------------------------------- */
  /*  Document drafts — versioned alternates, promoted with promote   */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  Animations — per-project React components posts can embed       */
  /* ---------------------------------------------------------------- */

  defineMcpQuery({
    name: "wryte_animations_list",
    description: "List a project's animation components with their source.",
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
    metadata: meta({ scopes: [SCOPES.write], auditArgs: false }),
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
    metadata: meta({ scopes: [SCOPES.write], auditArgs: false }),
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
    metadata: meta({ scopes: [SCOPES.write], auditArgs: false }),
  }),

  defineMcpMutation({
    name: "wryte_animations_remove",
    description: "Delete an animation component.",
    fn: internal.mcp.handlers.animations.remove,
    args: { caller: mcpCallerValidator, animationId: v.id("animations") },
    identityArg: "caller",
    metadata: WRITE,
  }),

  /* ---------------------------------------------------------------- */
  /*  Research, ideas, snippets                                        */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  Calendar & scheduling                                            */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  Publishing                                                       */
  /* ---------------------------------------------------------------- */

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

  /* ---------------------------------------------------------------- */
  /*  Media                                                            */
  /* ---------------------------------------------------------------- */

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
    // Never audit the args: a base64 image in an audit row is pure write cost
    // and the row's other columns already say who uploaded what, and when.
    metadata: meta({ scopes: [SCOPES.media], auditArgs: false }),
  }),

  /* ---------------------------------------------------------------- */
  /*  Stats & insights                                                 */
  /* ---------------------------------------------------------------- */

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
