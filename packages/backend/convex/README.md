# Convex backend — folder map

This directory is grouped by domain so a new contributor can locate a feature
by name. Every `.ts` file is a Convex module — the file path is the API path
(e.g. `convex/cms/documents.ts` is invoked as `api.cms.documents.list`).
Files in directories starting with `_` (`_lib`, `_pools`, `_generated`) are
not registered as Convex functions and are safe for pure utilities.

```
convex/
├── _generated/         autogen — never hand-edit
├── _lib/               shared helpers (no Convex registrars)
├── _pools/             Workpool instances (concurrency caps)
├── providers/          external media providers (UploadThing/Cloudinary/GitHub)
├── workflows/          Convex Workflows (credential rotation)
│
├── schema.ts           database schema (root-required)
├── auth.config.ts      Clerk JWT integration (root-required)
├── http.ts             HTTP endpoints (health check) (root-required)
├── crons.ts            cron jobs (root-required)
├── convex.config.ts    component registration (root-required)
│
├── cms/                content management
├── media/              uploads + provider credentials
├── ai/                 AI enhancement + provider credentials
├── integrations/       external services (GitHub, Clerk, secrets, scheduling)
└── account/            user identity + account-level operations
```

## Domain folders

### `cms/` — content domain (`api.cms.*`, `internal.cms.*`)

| File | Purpose |
| --- | --- |
| `documents.ts` | Documents CRUD, bulk import/delete batch tracking |
| `projects.ts` | Projects CRUD, sort order, cascade delete |
| `boardColumns.ts` | Kanban column config (stored on `projects.boardColumns`) |

### `media/` — uploads + media credentials (`api.media.*`, `internal.media.*`)

| File | Purpose |
| --- | --- |
| `uploads.ts` | Node-only actions: upload, list, delete, deleteByRef |
| `uploadsDb.ts` | Queries / internal mutations against `media` and `mediaUsage` |
| `credentials.ts` | Node-only actions: save, verify, rotate, delete a provider key |
| `credentialsDb.ts` | Queries / internal mutations against `mediaCredentials` |

### `ai/` — AI enhancement + credentials (`api.ai.*`, `internal.ai.*`)

| File | Purpose |
| --- | --- |
| `enhance.ts` | Mutations/queries that kick off enhancement streams |
| `enhanceActions.ts` | Node-only streaming actions (Anthropic/OpenAI/OpenRouter) |
| `credentials.ts` | Node-only actions: save, verify, rotate, delete a provider key |
| `credentialsDb.ts` | Queries / internal mutations against `aiCredentials` |

### `integrations/` — external services (`api.integrations.*`, `internal.integrations.*`)

| File | Purpose |
| --- | --- |
| `github.ts` | Octokit-based publish/import/delete actions |
| `clerk.ts` | Clerk Backend SDK wrapper (fetches fresh OAuth tokens) |
| `scheduling.ts` | Convex Workflow for durable scheduled publishes |
| `secretStore.ts` | WorkOS Vault wrapper (CRUD over encrypted secrets) |

### `account/` — user identity (`api.account.*`, `internal.account.*`)

| File | Purpose |
| --- | --- |
| `users.ts` | `getOrCreate`, `get`, GitHub PAT save, compression defaults |
| `selfDestruct.ts` | Wipe every user-scoped row + vault entry + workflow |

## Utility folders

### `_lib/` — shared helpers

| File | Purpose |
| --- | --- |
| `auth.ts` | `getCurrentUser` / `getAuthedUserOrNull` / `getGithubToken` / `parseClerkUserId` |
| `compression.ts` | `compressionSettingsValidator` (shared by schema + projects + users) |
| `quotas.ts` | `QUOTAS`, `isAllowedMime`, `currentMonthBucket` |
| `rateLimits.ts` | Central `rateLimiter` config + `getRateLimitKey` |

### `_pools/` — Workpool instances

| File | Purpose |
| --- | --- |
| `import.ts` | Bulk GitHub-to-Convex blog import pool (`maxParallelism: 5`) |
| `upload.ts` | Media upload pool + nightly maintenance pool |

### `providers/` — media backends

The dispatcher in `providers/index.ts` is the only file other code should
import from this folder. Each backend (`uploadthing.ts`, `cloudinary.ts`,
`github.ts`) implements `uploadOne` / `listFiles` / `deleteFile` / `ping`.

### `workflows/` — Convex Workflows

Crash-safe multi-step flows. Today only `rotateCredential.ts` lives here
(verify-new-key → swap-pointer → delete-old-vault-entry).

## Conventions

- **Naming.** `X.ts` holds public actions (often Node-only). `XDb.ts` holds
  the queries and internal mutations they call via `ctx.runQuery` /
  `ctx.runMutation`. Convex forbids mutations in `"use node"` files, so the
  split is structural.
- **Auth.** Every public mutation calls `getCurrentUser(ctx)` from `_lib/auth`.
  Every public query that gracefully degrades calls `getAuthedUserOrNull(ctx)`.
- **Rate limits.** Add a new entry in `_lib/rateLimits.ts` keyed
  `"<domain>:<operation>"` and gate every public mutation/action on it.
- **Internal calls.** Domain modules call siblings via `internal.<folder>.<file>.<fn>`.
  E.g. `cms/projects.ts` calls `internal.cms.documents.cascadeDeleteScheduledPublishesForDoc`.
- **Cascading deletes.** When a row owns children, extract the cascade into a
  helper in the parent's file (see `cms/documents.ts:cascadeDeleteScheduledPublishesForDoc`)
  and call it from every delete site.

## Adding a new feature

1. Decide which domain it belongs to (`cms`, `media`, `ai`, `integrations`,
   `account`). If none fits, add a new top-level folder rather than droppingx
   the file at the root.
2. If the feature needs Node-only code (any SDK with Node deps), split into
   `feature.ts` (Node, `"use node"`) and `featureDb.ts` (default runtime).
3. Add the rate-limit entries in `_lib/rateLimits.ts`.
4. Auth at the boundary — use `getCurrentUser` / `getAuthedUserOrNull`.
5. If you need pure helpers, put them in `_lib/<topic>.ts` (no Convex registrars).
