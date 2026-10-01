# Tool reference

All 41 tools the Wryte MCP server exposes, from `convex/mcp/tools.ts`.

An agent only ever *sees* the tools its granted capabilities allow. The catalog is
filtered per request, so a read-only connection lists no write or media tools.

Arguments below are what you pass. Each tool also takes an injected `caller` argument
that is filled in server-side from your verified token and stripped from anything a
client sends, so it never appears in the schema you see.

The Main version of a post belongs to you. No tool reads or writes the Main body,
promotes a draft, schedules or publishes.

## Projects

### `wryte_projects_list`

List the caller's writing projects with repo, branch, content path and format, and media storage mode.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: none

### `wryte_project_context`

Everything an agent must follow for one project: frontmatter schema, statuses an agent may set, md or mdx, animation language, check level and rules, media provider and limits.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `projectId`: id:projects

## Posts

### `wryte_documents_list`

Paginated list of a project's posts (id, title, slug). Page with the returned cursor.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `projectId`: id:projects, `paginationOpts`: paginationOpts

### `wryte_documents_search`

Search post titles across one project or all of them.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `term`: string, `projectId`?: id:projects, `limit`?: number

### `wryte_documents_get`

One post's title, slug, status, tags, frontmatter and Main word count. Never the Main body.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `documentId`: id:documents

### `wryte_documents_workspace`

Everything around a post in one call: metadata, draft tabs, research, animations referenced by drafts with their check state, and uploaded images.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `documentId`: id:documents

### `wryte_documents_backlinks`

List posts that link to this one.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `documentId`: id:documents

### `wryte_documents_history`

Publish history for a post, newest first.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `documentId`: id:documents

### `wryte_documents_create`

Create a post shell. The Main body stays empty; writing goes in a draft. The slug must be lowercase kebab-case and unused in the project, and frontmatter must be a JSON object with every required field from `wryte_project_context`.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `projectId`: id:projects, `title`: string, `slug`: string, `status`?: string, `tags`?: string[], `frontmatter`?: string

### `wryte_documents_update`

Move a post on the board or retag it. Only statuses from `wryte_project_context` are allowed.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `documentId`: id:documents, `status`?: string, `tags`?: string[]

### `wryte_documents_trash`

Move a post to the project trash. Refused once its Main version has content.

- **Kind**: mutation
- **Requires**: `wryte:trash`
- **Arguments**: `documentId`: id:documents

### `wryte_trash_restore`

Restore a trashed post.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `documentId`: id:documents

## Drafts

### `wryte_drafts_list`

List a post's draft tabs (metadata only, oldest first).

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `documentId`: id:documents

### `wryte_drafts_get`

Get one draft with its title, body and frontmatter.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `draftId`: id:document_drafts

### `wryte_drafts_snapshot`

Add a full draft tab, labelled `<model> · <harness>` (required). Returns `unknownComponents` and `mdxError` for mdx projects.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `documentId`: id:documents, `label`: string, `title`: string, `content`: string, `frontmatter`?: string, `summary`?: string

### `wryte_drafts_update`

Change any part of a draft. Send only what changes.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `draftId`: id:document_drafts, `label`?: string, `summary`?: string, `frontmatter`?: string, `title`?: string, `content`?: string

### `wryte_drafts_remove`

Delete a draft tab. The Main version is untouched.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `draftId`: id:document_drafts

## Research

### `wryte_research_list`

List research attached to a post.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `documentId`: id:documents

### `wryte_research_create`

File 1 to 15 research items per call. Every draft of the post shares this pool. Links must be http or https.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `documentId`: id:documents, `items`: { `type`: note|source|quote|outline|idea|ai_summary, `title`: string, `content`: string, `url`?: string, `sourceName`?: string, `selectedForAi`?: boolean }[]

### `wryte_research_update`

Update a research item.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `researchId`: id:document_research, `type`?: string, `title`?: string, `content`?: string, `url`?: string, `sourceName`?: string, `selectedForAi`?: boolean

### `wryte_research_remove`

Delete a research item.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `researchId`: id:document_research

## Animations

### `wryte_animations_list`

List a project's animation components (id, name, updatedAt).

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `projectId`: id:projects

### `wryte_animations_get_source`

Get one animation's React source by id.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `animationId`: id:animations

### `wryte_animations_upsert`

Create or replace an animation by PascalCase name. Runs the same contract and type checks as the gallery, per the project's settings, records the result and returns diagnostics. `dryRun` checks without saving.

- **Kind**: action
- **Requires**: `wryte:write`
- **Arguments**: `projectId`: id:projects, `name`: string, `source`: string, `dryRun`?: boolean

### `wryte_animations_remove`

Delete an animation component.

- **Kind**: mutation
- **Requires**: `wryte:write`
- **Arguments**: `animationId`: id:animations

## Media

### `wryte_media_list`

List a project's uploaded media, paginated.

- **Kind**: action
- **Requires**: `wryte:media`
- **Arguments**: `projectId`: id:projects, `cursor`?: string, `limit`?: number

### `wryte_media_upload_url`

Upload a file from disk. Returns a single-use URL, valid 10 minutes. POST the raw bytes with `curl --data-binary` and the right `Content-Type`; Wryte sends the file straight to the project's media provider and responds with `url` and ready-to-paste `markdown`. Nothing is kept in Wryte's own storage.

- **Kind**: mutation
- **Requires**: `wryte:media`
- **Arguments**: `projectId`: id:projects, `documentId`?: id:documents, `filename`?: string, `alt`?: string

### `wryte_media_upload`

Upload an image or video to the project's provider (GitHub, UploadThing, Cloudinary or R2) from an https `sourceUrl`, or from `base64` for small files (then `filename` and `mime` are required). Returns `url` and ready-to-paste `markdown`.

- **Kind**: action
- **Requires**: `wryte:media`
- **Arguments**: `projectId`: id:projects, `sourceUrl`?: string, `base64`?: string, `filename`?: string, `mime`?: string, `alt`?: string, `documentId`?: id:documents

## Notes

Private notes and tasks on the user's Notes board (columns Notes, To do, Doing, Done). Notes are never published. Unlike posts, agents write notes directly; prefer `wryte_notes_append` for adding text.

### `wryte_notes_list`

The user's notes, 25 per page: title, excerpt, status, due date, group. No bodies. Filter by group name, status (`todo`, `doing`, `done`, or `notes` for plain notes, in board order), `dueBefore` (YYYY-MM-DD, needs a task status) or a linked post. Page with `continueCursor`.

- **Kind**: query
- **Requires**: `wryte:read`, `wryte:notes`
- **Arguments**: `group`?: string, `status`?: notes|todo|doing|done, `dueBefore`?: string, `linkedDocumentId`?: id:documents, `cursor`?: string

### `wryte_notes_search`

Search note titles and bodies. Up to 16 hits with short snippets. Start here before creating a note that may already exist.

- **Kind**: query
- **Requires**: `wryte:read`, `wryte:notes`
- **Arguments**: `query`: string

### `wryte_notes_get`

One note: metadata, rev, group, linked posts, refs and body. The body is cut at `maxChars` (default 20,000); `truncated` says so and `totalChars` gives the full length. Keep `rev` for `wryte_notes_update`.

- **Kind**: query
- **Requires**: `wryte:read`, `wryte:notes`
- **Arguments**: `noteId`: id:notes, `maxChars`?: number

### `wryte_note_groups_list`

The user's note groups with their note counts.

- **Kind**: query
- **Requires**: `wryte:read`, `wryte:notes`
- **Arguments**: none

### `wryte_notes_create`

Create a note at the top of its board column. `group` is a name, found or created. `status` and `dueDate` make it a task. `refs` attaches up to 20 references: `{kind: "pr"|"issue"|"link", url}` or `{kind: "comment", text, author?, url?}`. `documentIds` links up to 20 posts. Returns `noteId`, `rev` and `url`.

- **Kind**: mutation
- **Requires**: `wryte:notes`
- **Arguments**: `title`: string, `content`?: string, `group`?: string, `status`?: todo|doing|done, `dueDate`?: string, `documentIds`?: id:documents[], `refs`?: { `kind`: pr|issue|comment|link, `url`?: string, `text`?: string, `author`?: string }[]

### `wryte_notes_update`

Change a note's title, status, due date, group, linked posts or refs; `null` clears status, due date or group. Changing status moves the card to the top of that column. Replacing `content` needs `expectedRev` from `wryte_notes_get` and is refused if the user edited since. `refs` adds to the existing ones.

- **Kind**: mutation
- **Requires**: `wryte:notes`
- **Arguments**: `noteId`: id:notes, `expectedRev`?: number, `title`?: string, `content`?: string, `status`?: todo|doing|done|null, `dueDate`?: string|null, `group`?: string|null, `documentIds`?: id:documents[], `refs`?: ref[]

### `wryte_notes_append`

Append markdown to the end of a note on a new line. Never overwrites what the user wrote. Use it for running logs.

- **Kind**: mutation
- **Requires**: `wryte:notes`
- **Arguments**: `noteId`: id:notes, `text`: string

### `wryte_notes_trash`

Move a note to the trash. The user can restore it for 30 days.

- **Kind**: mutation
- **Requires**: `wryte:trash`, `wryte:notes`
- **Arguments**: `noteId`: id:notes

## Note sharing

### `wryte_notes_share`

Create a public read-only link anyone can open without a Wryte account. Pass `noteIds` (1 to 50) or `group` (shows its newest 200 notes and follows the group as it changes), not both. Readers always see the latest version; trashed notes are hidden. Optional `title` and `expiresInDays` (1, 7 or 30; omit for no expiry). Only share when the user asks.

- **Kind**: mutation
- **Requires**: `wryte:notes`
- **Arguments**: `noteIds`?: id:notes[], `group`?: string, `title`?: string, `expiresInDays`?: 1|7|30

### `wryte_notes_shares_list`

The user's active public note links, newest first (up to 100).

- **Kind**: query
- **Requires**: `wryte:read`, `wryte:notes`
- **Arguments**: none

### `wryte_notes_share_revoke`

Revoke a public note link. The URL stops working at once; the notes are untouched.

- **Kind**: mutation
- **Requires**: `wryte:notes`
- **Arguments**: `shareId`: id:note_shares

## Calendar and stats

### `wryte_calendar_get`

Editorial calendar for one project: scheduled and published dates per post.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: `projectId`: id:projects

### `wryte_stats_get`

Writing stats across all projects: streak, word counts, goals, status breakdown.

- **Kind**: query
- **Requires**: `wryte:read`
- **Arguments**: none
