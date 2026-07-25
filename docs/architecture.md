# Architecture

## Why a monorepo

Wryte ships three surfaces from one codebase: a Next.js web app, an Electron
desktop shell, and a Convex backend. Before the split, all of it lived in one
package, which meant nothing stopped a shared utility from importing a page
component, or a store from reaching into a feature module. The workspace
boundaries make those mistakes fail at install time instead of at review time.

## Workspaces

| Workspace | Package | Role |
|-----------|---------|------|
| `apps/web` | `@wryte/web` | Next.js app — routes, features, app-specific UI |
| `apps/desktop` | `@wryte/desktop` | Electron shell — loads the deployed web app |
| `packages/ui` | `@wryte/ui` | Presentational primitives, no data access |
| `packages/logic` | `@wryte/logic` | Pure logic, hooks, stores, types |
| `packages/backend` | `@wryte/backend` | Convex functions and schema |

Dependency direction is one-way and enforced by what each package declares:

```
apps/web  →  @wryte/ui  →  @wryte/logic  →  @wryte/backend
```

`@wryte/ui` may use `@wryte/logic`. `@wryte/logic` may use `@wryte/backend` for
generated types. Neither may import from `apps/`. `apps/desktop` is fully
independent — it talks to the web app over HTTP, not over imports.

## How packages resolve

Packages are consumed as **untranspiled TypeScript source** through
`package.json` `exports` wildcards:

```json
// packages/ui/package.json
{ "exports": { "./*": "./src/*.tsx" } }

// packages/logic/package.json
{ "exports": { "./*": "./src/*.ts" } }
```

So `@wryte/ui/button` resolves straight to `packages/ui/src/button.tsx`. Next
compiles those files itself via `transpilePackages` in
`apps/web/next.config.ts`.

The consequence worth knowing: **there is no build step for a package, and no
`dist/` that can go stale.** Edit a file in `packages/logic` and the dev server
picks it up on the next request, exactly like a file inside `apps/web`.

`@wryte/backend` is the exception — Convex codegen emits `.js` + `.d.ts` pairs,
so its exports map is explicit rather than a wildcard:

```json
{
  "./_generated/api": {
    "types": "./convex/_generated/api.d.ts",
    "default": "./convex/_generated/api.js"
  },
  "./_generated/dataModel": "./convex/_generated/dataModel.d.ts",
  "./*": "./convex/*.ts"
}
```

## Tailwind and workspace packages

Tailwind v4's automatic source detection starts at the CSS file and walks the
app directory — it never reaches `packages/`. `apps/web/src/app/globals.css`
declares them explicitly:

```css
@source "../../../../packages/ui/src";
@source "../../../../packages/logic/src";
```

**A new shared package needs a new `@source` line**, or every class used only by
its components gets purged from the production build. This fails silently in
dev (where nothing is purged) and only shows up in production.

## Runtime data flow

```
Browser / Electron
        │
        ├─ Clerk middleware ── protects /dashboard, /editor, /projects, /settings, /admin
        │
        ├─ React Server Components + client components
        │       │
        │       └─ convex/react hooks ── live subscriptions
        │
        └─ Route handlers (/api/github/*) ── GitHub proxy with server-held tokens
                                    │
                            Convex deployment
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
   queries/mutations          actions (Node)              workflows
   documents, projects,       GitHub commits,             durable scheduled
   media, boards, tags        AI calls, uploads           publishing + retries
                                    │
                            WorkOS Vault ── per-user API keys, encrypted
```

## Secrets

User-supplied credentials — GitHub PATs, AI provider keys, media keys — are
never stored in the database and never held in environment variables. They are
encrypted in WorkOS Vault; Convex stores only opaque reference IDs and resolves
them per request inside server-side actions. A database dump yields no
plaintext keys.

## Desktop shell

`apps/desktop` is a thin Electron wrapper, not a second copy of the app:

- In development it probes ports 3000–3002 and attaches to the running dev server.
- In production it loads `https://wryte.xyz`.
- It owns native concerns only: window state, application menu, menu-bar tray,
  auto-update via `electron-updater`, connectivity and task worker processes,
  and offline/loading screens.

This is why it imports nothing from `apps/web` — the web app is a URL to it, not
a dependency. See [desktop.md](desktop.md).

## Task graph

`turbo.json` defines the build order:

- `build` depends on `^build` — upstream workspaces first
- `type` depends on `^type` — backend typechecks before logic, logic before ui
- `dev` is persistent and uncached
- `envMode` is `loose`, so `NEXT_PUBLIC_*`, Clerk, and Convex vars reach tasks
  without being enumerated

## Conventions

- **Bun only.** No npm, yarn, or pnpm.
- **Biome** for lint and format, configured once at the root.
- **Colocate hooks** with the feature that owns them. Only hooks shared by two
  unrelated features move to `packages/logic/src/hooks/`.
- **Pages stay thin** — compose from `components/`, `@wryte/ui`, and hooks.
- **Bound every Convex query** with `.take(n)`; never return unbounded lists.
- **Framer Motion** for animation, consistently — no ad-hoc CSS animation globals.
