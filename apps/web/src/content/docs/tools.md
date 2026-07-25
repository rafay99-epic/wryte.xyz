# Tool reference

All 21 tools the Wryte MCP server exposes. Generated from `convex/mcp/tools.ts`.

An agent only ever *sees* the tools its granted capabilities allow — the catalog is
filtered per request, so a read-only connection lists neither publish nor media tools.

Arguments below are what you pass. Each tool also takes an injected `caller` argument
that is filled in server-side from your verified token and stripped from anything a
client sends, so it never appears in the schema you see.

## Projects

### `wryte_projects_list`

List the caller's writing projects with repo, branch, content paths and media storage mode.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — none

## Documents

### `wryte_documents_list`

Paginated list of a project's documents (id, title, slug). Page with the returned cursor.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `projectId`: id:projects, `paginationOpts`: paginationOpts

### `wryte_documents_search`

Search document titles across one project or all of them. Start here when looking for an existing post.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `term`: string, `projectId`?: id:projects, `limit`?: number

### `wryte_documents_get`

Get one document by id: frontmatter, body, tags, status, publish state.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `documentId`: id:documents 

### `wryte_documents_backlinks`

List documents that link to this one.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `documentId`: id:documents 

### `wryte_documents_history`

Publish history for a document, newest first.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `documentId`: id:documents 

### `wryte_documents_create`

Create a document. Read the project's frontmatter-schema resource first so the frontmatter validates.

- **Kind** — mutation
- **Requires** — `wryte:write`
- **Arguments** — `projectId`: id:projects, `title`: string, `slug`: string, `status`?: string, `tags`?: v.array(string), `frontmatter`?: string, `content`?: string

### `wryte_documents_update`

Update a document's title, slug, body, frontmatter, status or tags. Send only the fields that change.

- **Kind** — mutation
- **Requires** — `wryte:write`
- **Arguments** — `documentId`: id:documents, `title`?: string, `slug`?: string, `content`?: string, `frontmatter`?: string, `status`?: string, `tags`?: v.array(string)

### `wryte_documents_trash`

Move a document to the project trash. Recoverable with wryte_trash_restore.

- **Kind** — mutation
- **Requires** — `wryte:trash`
- **Arguments** — `documentId`: id:documents 

## Research

### `wryte_research_list`

List research notes attached to a document.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `documentId`: id:documents 

### `wryte_research_create`

File a research finding against a document (quote, link, statistic, note). Use this for research rather than writing findings into the body.

- **Kind** — mutation
- **Requires** — `wryte:write`
- **Arguments** — `documentId`: id:documents, `type`: note|source|quote|outline|idea|ai_summary, `title`: string, `content`: string, `url`?: string, `sourceName`?: string, `selectedForAi`?: boolean

### `wryte_research_update`

Update a research note.

- **Kind** — mutation
- **Requires** — `wryte:write`
- **Arguments** — `researchId`: id:document_research, `title`?: string, `content`?: string, `url`?: string, `sourceName`?: string, `selectedForAi`?: boolean

### `wryte_research_remove`

Delete a research note.

- **Kind** — mutation
- **Requires** — `wryte:write`
- **Arguments** — `researchId`: id:document_research

## Calendar

### `wryte_calendar_get`

Editorial calendar for one project: scheduled and published dates per document.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — `projectId`: id:projects 

## Schedule

### `wryte_schedule_set`

Schedule a document to publish at a UTC epoch-millisecond timestamp.

- **Kind** — mutation
- **Requires** — `wryte:publish`
- **Arguments** — `documentId`: id:documents, `scheduledAt`: number, `socialPostText`?: string

### `wryte_schedule_cancel`

Cancel a document's scheduled publish.

- **Kind** — mutation
- **Requires** — `wryte:publish`
- **Arguments** — `documentId`: id:documents 

## Publish

### `wryte_publish_document`

Commit a document to its project's GitHub repo and mark it published.

- **Kind** — action
- **Requires** — `wryte:publish`
- **Arguments** — `documentId`: id:documents, `commitMessage`?: string, `socialPostText`?: string

## Media

### `wryte_media_list`

List a project's uploaded media, paginated.

- **Kind** — action
- **Requires** — `wryte:media`
- **Arguments** — `projectId`: id:projects, `cursor`?: string, `limit`?: number

### `wryte_media_upload`

Upload base64 media. Destination follows the project's media storage mode (GitHub, UploadThing or Cloudinary).

- **Kind** — action
- **Requires** — `wryte:media`
- **Arguments** — `projectId`: id:projects, `base64`: string, `mime`: string, `filename`: string, `documentId`?: id:documents

## Stats

### `wryte_stats_get`

Writing stats across all projects: streak, word counts, goals, status breakdown.

- **Kind** — query
- **Requires** — `wryte:read`
- **Arguments** — none

## Trash

### `wryte_trash_restore`

Restore a trashed document.

- **Kind** — mutation
- **Requires** — `wryte:write`
- **Arguments** — `documentId`: id:documents 
