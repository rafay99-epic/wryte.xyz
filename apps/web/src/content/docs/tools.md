# Tool reference

All 30 tools the Wryte MCP server exposes, from `convex/mcp/tools.ts`.

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
