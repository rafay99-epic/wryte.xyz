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
import {
  MAX_RESEARCH_BATCH,
  researchItemValidator,
  researchTypeValidator,
} from "../cms/documentResearch";
import {
  boardColumnValidator,
  noteStatusValidator,
  refInputValidator,
} from "../cms/notes/_lib/model";
import { DEFAULT_NOTE_CHARS } from "./agentInput";
import { SCOPES, type WryteToolMetadata } from "./scopes";

const READ = { scopes: [SCOPES.read] } satisfies WryteToolMetadata;
const WRITE = { scopes: [SCOPES.write] } satisfies WryteToolMetadata;
const MEDIA = { scopes: [SCOPES.media] } satisfies WryteToolMetadata;

const WRITE_BODY = {
  scopes: [SCOPES.write],
  auditArgs: { redact: ["content", "frontmatter", "items"] },
} satisfies WryteToolMetadata;

const NOTES_READ = {
  scopes: [SCOPES.read, SCOPES.notes],
} satisfies WryteToolMetadata;

const NOTES_TRASH = {
  scopes: [SCOPES.trash, SCOPES.notes],
} satisfies WryteToolMetadata;

const NOTES_BODY = {
  scopes: [SCOPES.notes],
  auditArgs: { redact: ["content", "refs"] },
} satisfies WryteToolMetadata;

const NOTES_APPEND = {
  scopes: [SCOPES.notes],
  auditArgs: { redact: ["text"] },
} satisfies WryteToolMetadata;

const WRITE_NO_AUDIT = {
  scopes: [SCOPES.write],
  auditArgs: false,
} satisfies WryteToolMetadata;

const MEDIA_NO_AUDIT = {
  scopes: [SCOPES.media],
  auditArgs: false,
} satisfies WryteToolMetadata;

export const tools: McpToolRegistration[] = [
  defineMcpQuery({
    name: "wryte_projects_list",
    description:
      "List the caller's writing projects with repo, branch, content path and format, and media storage mode.",
    fn: internal.mcp.handlers.projects.list,
    args: { caller: mcpCallerValidator },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_project_context",
    description:
      "Everything an agent must follow for one project: frontmatter schema, statuses an agent may set, md or mdx, animation language, check level and rules, media provider and limits. Call once per project before writing.",
    fn: internal.mcp.handlers.projects.context,
    args: { caller: mcpCallerValidator, projectId: v.id("projects") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_list",
    description:
      "Paginated list of a project's posts (id, title, slug). Page with the returned cursor.",
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
      "Search post titles across one project or all of them. Start here when looking for an existing post.",
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
      "One post's title, slug, status, tags, frontmatter and Main word count. The Main body belongs to the user and is never returned.",
    fn: internal.mcp.handlers.documents.get,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_workspace",
    description:
      "Everything around a post in one call: metadata, draft tabs, research, animations referenced by drafts with their check state, and uploaded images. Start here before adding to an existing post.",
    fn: internal.mcp.handlers.documents.workspace,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_backlinks",
    description: "List posts that link to this one.",
    fn: internal.mcp.handlers.documents.backlinks,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_documents_history",
    description: "Publish history for a post, newest first.",
    fn: internal.mcp.handlers.documents.history,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_documents_create",
    description:
      "Create a post shell: title, slug, frontmatter, optional status and tags. The Main body stays empty for the user; put your writing in a draft with wryte_drafts_snapshot.",
    fn: internal.mcp.handlers.documents.create,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      title: v.string(),
      slug: v.string(),
      status: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      frontmatter: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_documents_update",
    description:
      "Move a post on the board or retag it. Only statuses from wryte_project_context are allowed; scheduling and publishing stay with the user.",
    fn: internal.mcp.handlers.documents.update,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      status: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpMutation({
    name: "wryte_documents_trash",
    description:
      "Move a post to the project trash. Refused once the user has written its Main version. Recoverable with wryte_trash_restore.",
    fn: internal.mcp.handlers.documents.trash,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: { scopes: [SCOPES.trash] } satisfies WryteToolMetadata,
  }),

  defineMcpMutation({
    name: "wryte_trash_restore",
    description: "Restore a trashed post.",
    fn: internal.mcp.handlers.publishing.trashRestore,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpQuery({
    name: "wryte_drafts_list",
    description: "List a post's draft tabs (metadata only, oldest first).",
    fn: internal.mcp.handlers.drafts.list,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpQuery({
    name: "wryte_drafts_get",
    description: "Get one draft with its title, body and frontmatter.",
    fn: internal.mcp.handlers.drafts.get,
    args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_drafts_snapshot",
    description:
      'Add a full draft tab to a post: label, title, body, optional frontmatter and summary. Label it "<model> · <harness>", e.g. "Opus 5.5 · Claude Code". Returns unknownComponents (tags with no matching animation) and mdxError for mdx projects.',
    fn: internal.mcp.handlers.drafts.snapshot,
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
    name: "wryte_drafts_update",
    description:
      "Change any part of a draft: label, summary, frontmatter, title or body. Send only what changes. Returns the same checks as wryte_drafts_snapshot when the body changes.",
    fn: internal.mcp.handlers.drafts.update,
    args: {
      caller: mcpCallerValidator,
      draftId: v.id("document_drafts"),
      label: v.optional(v.string()),
      summary: v.optional(v.string()),
      frontmatter: v.optional(v.string()),
      title: v.optional(v.string()),
      content: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_drafts_remove",
    description: "Delete a draft tab. The Main version is untouched.",
    fn: internal.mcp.handlers.drafts.remove,
    args: { caller: mcpCallerValidator, draftId: v.id("document_drafts") },
    identityArg: "caller",
    metadata: WRITE,
  }),

  defineMcpQuery({
    name: "wryte_research_list",
    description: "List research attached to a post.",
    fn: internal.mcp.handlers.content.researchList,
    args: { caller: mcpCallerValidator, documentId: v.id("documents") },
    identityArg: "caller",
    metadata: READ,
  }),

  defineMcpMutation({
    name: "wryte_research_create",
    description: `File research against a post, up to ${String(MAX_RESEARCH_BATCH)} items per call (note, source, quote, outline, idea). Every draft of the post shares this pool. Never put research in a draft body.`,
    fn: internal.mcp.handlers.content.researchCreate,
    args: {
      caller: mcpCallerValidator,
      documentId: v.id("documents"),
      items: v.array(researchItemValidator),
    },
    identityArg: "caller",
    metadata: WRITE_BODY,
  }),

  defineMcpMutation({
    name: "wryte_research_update",
    description: "Update a research item.",
    fn: internal.mcp.handlers.content.researchUpdate,
    args: {
      caller: mcpCallerValidator,
      researchId: v.id("document_research"),
      type: v.optional(researchTypeValidator),
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
    description: "Delete a research item.",
    fn: internal.mcp.handlers.content.researchRemove,
    args: {
      caller: mcpCallerValidator,
      researchId: v.id("document_research"),
    },
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

  defineMcpAction({
    name: "wryte_animations_upsert",
    description:
      "Create or replace an animation by PascalCase name (React source, tsx or jsx per wryte_project_context). Runs the project's contract and type checks, records the result, and returns diagnostics. Fix every error and upsert again. dryRun checks without saving.",
    fn: internal.mcp.handlers.animationUpsert.upsert,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      name: v.string(),
      source: v.string(),
      dryRun: v.optional(v.boolean()),
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

  defineMcpMutation({
    name: "wryte_media_upload_url",
    description:
      "Upload a file from disk: returns a single-use URL (10 minutes). POST the raw bytes with curl --data-binary and the right Content-Type; the file goes straight to the project's media provider (GitHub, UploadThing, Cloudinary or R2) and the response has url and ready-to-paste markdown. Pass documentId to tag the post.",
    fn: internal.mcp.handlers.media.uploadUrl,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      documentId: v.optional(v.id("documents")),
      filename: v.optional(v.string()),
      alt: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: MEDIA,
  }),

  defineMcpAction({
    name: "wryte_media_upload",
    description:
      "Upload an image or video to the project's media provider (GitHub, UploadThing, Cloudinary or R2) from an https sourceUrl, or from base64 for small files (filename and mime required). For a file on disk use wryte_media_upload_url instead. Pass documentId to tag the post. Returns url and ready-to-paste markdown.",
    fn: internal.mcp.handlers.nodeActions.mediaUpload,
    args: {
      caller: mcpCallerValidator,
      projectId: v.id("projects"),
      sourceUrl: v.optional(v.string()),
      base64: v.optional(v.string()),
      filename: v.optional(v.string()),
      mime: v.optional(v.string()),
      alt: v.optional(v.string()),
      documentId: v.optional(v.id("documents")),
    },
    identityArg: "caller",
    metadata: MEDIA_NO_AUDIT,
  }),

  defineMcpQuery({
    name: "wryte_calendar_get",
    description:
      "Editorial calendar for one project: scheduled and published dates per post.",
    fn: internal.mcp.handlers.documents.calendar,
    args: { caller: mcpCallerValidator, projectId: v.id("projects") },
    identityArg: "caller",
    metadata: READ,
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

  defineMcpQuery({
    name: "wryte_notes_list",
    description:
      'List the user\'s private notes, 25 per page: title, excerpt, status, due date, group. No bodies; read one with wryte_notes_get. Filter by group name, status ("todo", "doing", "done", or "notes" for plain notes without a status, in board order), dueBefore (YYYY-MM-DD, needs a task status) or a linked post. Page with continueCursor.',
    fn: internal.mcp.handlers.notes.list,
    args: {
      caller: mcpCallerValidator,
      group: v.optional(v.string()),
      status: v.optional(boardColumnValidator),
      dueBefore: v.optional(v.string()),
      linkedDocumentId: v.optional(v.id("documents")),
      cursor: v.optional(v.string()),
    },
    identityArg: "caller",
    metadata: NOTES_READ,
  }),

  defineMcpQuery({
    name: "wryte_notes_search",
    description:
      "Search note titles and bodies. Returns up to 16 hits with short snippets. Start here before creating a note that may already exist.",
    fn: internal.mcp.handlers.notes.search,
    args: { caller: mcpCallerValidator, query: v.string() },
    identityArg: "caller",
    metadata: NOTES_READ,
  }),

  defineMcpQuery({
    name: "wryte_notes_get",
    description: `One note: metadata, rev, group, linked posts, refs (PRs, issues, comments, links) and body. The body is cut at maxChars (default ${String(DEFAULT_NOTE_CHARS)}); truncated says so and totalChars gives the full length. Keep rev for wryte_notes_update.`,
    fn: internal.mcp.handlers.notes.get,
    args: {
      caller: mcpCallerValidator,
      noteId: v.id("notes"),
      maxChars: v.optional(v.number()),
    },
    identityArg: "caller",
    metadata: NOTES_READ,
  }),

  defineMcpQuery({
    name: "wryte_note_groups_list",
    description: "List the user's note groups with their note counts.",
    fn: internal.mcp.handlers.notes.groups,
    args: { caller: mcpCallerValidator },
    identityArg: "caller",
    metadata: NOTES_READ,
  }),

  defineMcpMutation({
    name: "wryte_notes_create",
    description:
      'Create a private note. Notes are never published; they live on the user\'s board (columns Notes, To do, Doing, Done) and new ones go to the top of their column. group is a name, found or created; use "Work log" for session logs. status (todo, doing, done) and dueDate (YYYY-MM-DD) make it a task. refs attaches up to 20 references: {kind: "pr"|"issue"|"link", url} or {kind: "comment", text, author?, url?}. File follow-ups as tasks: wryte_notes_create { title, group, status: "todo", content, refs: [{kind: "pr", url}, {kind: "comment", text, author}] }. documentIds links up to 20 posts. Returns noteId, rev and the note\'s web path.',
    fn: internal.mcp.handlers.notes.create,
    args: {
      caller: mcpCallerValidator,
      title: v.string(),
      content: v.optional(v.string()),
      group: v.optional(v.string()),
      status: v.optional(noteStatusValidator),
      dueDate: v.optional(v.string()),
      documentIds: v.optional(v.array(v.id("documents"))),
      refs: v.optional(v.array(refInputValidator)),
    },
    identityArg: "caller",
    metadata: NOTES_BODY,
  }),

  defineMcpMutation({
    name: "wryte_notes_update",
    description:
      "Change a note's title, status, dueDate, group, linked posts or refs; null clears status, dueDate or group. Changing status moves the card to the top of that board column (status null moves it back to Notes). Replacing content needs expectedRev from wryte_notes_get and is refused if the user edited since. Prefer wryte_notes_append for adding text. documentIds replaces the whole link set; refs adds references (duplicates are skipped, at most 20 per note).",
    fn: internal.mcp.handlers.notes.update,
    args: {
      caller: mcpCallerValidator,
      noteId: v.id("notes"),
      expectedRev: v.optional(v.number()),
      title: v.optional(v.string()),
      content: v.optional(v.string()),
      status: v.optional(v.union(noteStatusValidator, v.null())),
      dueDate: v.optional(v.union(v.string(), v.null())),
      group: v.optional(v.union(v.string(), v.null())),
      documentIds: v.optional(v.array(v.id("documents"))),
      refs: v.optional(v.array(refInputValidator)),
    },
    identityArg: "caller",
    metadata: NOTES_BODY,
  }),

  defineMcpMutation({
    name: "wryte_notes_append",
    description:
      "Append markdown to the end of a note on a new line. The safe way to add to a note: it never overwrites what the user wrote. Use it for running logs.",
    fn: internal.mcp.handlers.notes.append,
    args: {
      caller: mcpCallerValidator,
      noteId: v.id("notes"),
      text: v.string(),
    },
    identityArg: "caller",
    metadata: NOTES_APPEND,
  }),

  defineMcpMutation({
    name: "wryte_notes_trash",
    description:
      "Move a note to the trash. The user can restore it in Wryte for 30 days.",
    fn: internal.mcp.handlers.notes.trash,
    args: { caller: mcpCallerValidator, noteId: v.id("notes") },
    identityArg: "caller",
    metadata: NOTES_TRASH,
  }),
];
