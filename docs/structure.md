# Project Structure

Wryte is a **Bun workspaces + Turborepo** monorepo. Five workspaces, one-way
dependency flow, no per-package build step.

```
wryte.xyz/
├── apps/
│   ├── web/                        # @wryte/web — Next.js 16 App Router
│   │   ├── src/
│   │   │   ├── app/                #   Routes
│   │   │   │   ├── (marketing)/    #     Public: landing, how-it-works, changelog, preview
│   │   │   │   ├── (app)/          #     Authenticated: dashboard, editor, projects, settings
│   │   │   │   └── api/            #     Route handlers (GitHub proxy, tokens)
│   │   │   │       └── github/_lib/ #      Route-only helpers (Clerk GitHub token)
│   │   │   ├── components/         #   App-specific UI
│   │   │   │   ├── layout/         #     Shell: sidebar, header, navigation
│   │   │   │   ├── providers/      #     Theme, Convex, query, toasts
│   │   │   │   ├── markdown/       #     MDX runtime, embeds, mermaid
│   │   │   │   ├── animations/     #     Animation error boundary, delete dialog
│   │   │   │   ├── editor/         #     Sync-conflict banner (+ its hook)
│   │   │   │   └── …               #     dialogs, forms, diff
│   │   │   ├── features/           #   Feature modules (see below)
│   │   │   └── middleware.ts       #   Clerk route protection
│   │   ├── e2e/                    #   Playwright specs
│   │   ├── scripts/                #   stamp-version, changelog-new
│   │   ├── public/                 #   Static assets
│   │   └── vercel.json             #   Build contract (Root Directory = apps/web)
│   │
│   └── desktop/                    # @wryte/desktop — Electron shell
│       ├── main.cjs                #   Entry: lifecycle, IPC wiring, worker spawn
│       ├── src/
│       │   ├── window/             #     BrowserWindow, state, offline + loading screens
│       │   ├── menu/               #     Application menu
│       │   ├── tray/               #     Menu-bar tray
│       │   ├── updater/            #     electron-updater flow
│       │   └── workers/            #     Connectivity child process
│       ├── assets/                 #   App icon used at runtime
│       ├── build/                  #   electron-builder buildResources (icon.icns source)
│       └── electron-builder.js     #   Packaging + publish config
│
├── packages/
│   ├── ui/                         # @wryte/ui — presentational primitives
│   │   └── src/                    #   button, dialog, select, tabs… (one per file)
│   │
│   ├── logic/                      # @wryte/logic — shared non-UI logic (.ts only)
│   │   ├── src/
│   │   │   ├── lib/                #   Pure helpers: utils, seo, escape, fuzzy, frecency,
│   │   │   │   │                   #   timezone, profile accents, MCP endpoint, weekly progress
│   │   │   │   ├── editor/         #     Editor text logic: outline, lists, diff, lint, publish checklist
│   │   │   │   ├── readability/    #     Readability analysis and its Web Worker
│   │   │   │   ├── animations/     #     Animation compiler (sucrase), templates, check protocol
│   │   │   │   ├── dom/            #     Framework-free DOM measurement (textarea caret)
│   │   │   │   └── frontmatter-detection/, image-compression/, watermark-removal/
│   │   │   ├── hooks/              #   Cross-feature React hooks
│   │   │   ├── stores/             #   Zustand stores (editor, board, calendar, search…)
│   │   │   └── types/              #   Shared types (content, frontmatter, project and account settings)
│   │   └── tests/                  #   bun test suites
│   │
│   └── backend/                    # @wryte/backend — Convex
│       ├── convex/
│       │   ├── cms/                #   Projects, documents, versions, publishing
│       │   ├── media/              #   Uploads and media library
│       │   ├── ai/                 #   AI provider integrations
│       │   ├── integrations/       #   GitHub, Clerk, secret store
│       │   ├── syndication/        #   Cross-posting providers
│       │   ├── workflows/          #   Durable scheduled publishing
│       │   ├── account/            #   User settings and preferences
│       │   ├── support/            #   Support tickets
│       │   ├── _lib/               #   Shared server utilities (auth, validation)
│       │   ├── _generated/         #   Convex codegen — committed, do not edit
│       │   └── schema.ts           #   Database schema
│       └── tests/                  #   Backend assertion suites
│
├── docs/                           # This documentation
├── .github/workflows/              # CI/CD (ci-cd.yml, dependency-check.yml)
├── patches/                        # bun patchedDependencies
├── turbo.json                      # Task graph
├── tsconfig.base.json              # Shared compiler options
├── biome.json                      # Lint + format, whole repo
└── bunfig.toml                     # Bun install config
```

## Feature modules

`apps/web/src/features/` holds one folder per product surface. Each owns its
own `components/` and `hooks/`. Pure logic lives in `@wryte/logic`; a feature
keeps a `lib/` only for code tied to web-only dependencies (lucide icons, the
TypeScript compiler API, `node:fs`), e.g. `editor/lib/slash/commands.ts` and
`editor/lib/animations/checks/`.

| Module | What it is |
|--------|-----------|
| `editor` | Markdown editor: toolbar, preview, autosave, sprint mode, AI, publish flow |
| `content-dashboard` | Table + kanban board views, bulk actions, tags, imports |
| `dashboard` | Home: stats, streak, activity heatmap, upcoming schedule |
| `calendar` | Global and per-project publishing calendars |
| `project-settings` | Per-project config: GitHub, AI, media, syndication, frontmatter |
| `account-settings` | Profile, appearance, shortcuts, media, support, self-destruct |
| `media-library` | Project media browsing and management |
| `command-palette` | Fuzzy command launcher with frecency ranking, settings-pane search, and full-text body search |
| `sync-conflicts` | Conflict resolution when local and remote diverge |
| `animation-gallery` | Reusable animation snippets for MDX |
| `marketing` | Landing-page sections and canvas animations |
| `profile` | Public author profile pages |
| `trash` | Soft-deleted document recovery |
| `new-project`, `new-article`, `new-project-document` | Creation wizards |
| `project-detail`, `project-dashboard`, `projects-list` | Project navigation |

## Import rules

Never reach across a workspace with a relative path — use the package name.

| Importing | Specifier |
|-----------|-----------|
| App-local file inside `apps/web` | `@/features/editor/…`, `@/components/layout/…` |
| Shared primitive | `@wryte/ui/button` |
| Shared logic | `@wryte/logic/lib/utils`, `@wryte/logic/stores/editor-store` |
| Shared types | `@wryte/logic/types/board` |
| Convex API | `@wryte/backend/_generated/api` |
| Convex types | `@wryte/backend/_generated/dataModel` |

Dependencies flow one way:

```
apps/web  →  @wryte/ui  →  @wryte/logic  →  @wryte/backend
```

`apps/desktop` depends on none of them — it loads the deployed web app over
HTTP. An import that reverses the arrow is a design problem, not a config one.

## Where new code goes

| You are adding | Put it in |
|----------------|-----------|
| A route or page | `apps/web/src/app/` |
| UI for one feature | `apps/web/src/features/<feature>/components/` |
| A hook used by one feature | `apps/web/src/features/<feature>/hooks/` |
| A hook used by two unrelated features | `packages/logic/src/hooks/` |
| A generic, presentation-only primitive | `packages/ui/src/` |
| A pure function or store | `packages/logic/src/lib/` or `…/stores/` |
| A type or icon-free constant shared across files | `packages/logic/src/types/` |
| Logic that needs icons, `node:fs`, or the TS compiler | `apps/web/src/features/<feature>/lib/` |
| A helper used only by API routes | `apps/web/src/app/api/<area>/_lib/` |
| A query, mutation, or action | `packages/backend/convex/<domain>/` |
| Electron main-process behaviour | `apps/desktop/src/` |

See [architecture.md](architecture.md) for why the boundaries sit where they do.
