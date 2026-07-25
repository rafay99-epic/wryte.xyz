@AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`packages/backend/convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->


## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.


## Assistant responsibilities

- **Code quality**: Write **clean, scalable code** with a **clear structure**. Prefer small, focused modules; keep boundaries obvious (data layer vs UI vs shared utilities); avoid piling unrelated logic into a single file.
- **Workspace boundaries**: This is a Bun + Turborepo monorepo. Put code where it belongs and never reach across a boundary with a relative path — always use the package name.
  - `apps/web` — the Next.js app: routes (`src/app`), features (`src/features`), app-specific components (`src/components`). Internal imports use the `@/*` alias.
  - `apps/desktop` — the Electron shell (CommonJS, `main.cjs` + `src/`). It loads the deployed web app; it must not import from `apps/web`.
  - `packages/ui` (`@wryte/ui`) — presentational primitives only. One component per file, imported as `@wryte/ui/<file>`. No Convex calls, no feature logic.
  - `packages/logic` (`@wryte/logic`) — framework-light shared logic: `lib/`, `hooks/`, `stores/`, `types/`, imported as `@wryte/logic/lib/utils` etc. May depend on `@wryte/backend`, never on `@wryte/ui` or on `apps/*`.
  - `packages/backend` (`@wryte/backend`) — all Convex functions and schema. Consumers import `@wryte/backend/_generated/api` and `@wryte/backend/_generated/dataModel`.
  - Dependency direction is one-way: `apps/web` → `@wryte/ui` → `@wryte/logic` → `@wryte/backend`. A new import that reverses it is a design bug, not a config problem.
- **Hooks**: **Colocate hooks with their feature.** Feature-specific hooks live in a `hooks/` subfolder inside the feature or component directory that owns them (e.g. `apps/web/src/features/editor/hooks/`, `apps/web/src/components/layout/hooks/`). Hooks used by two or more **unrelated** features go in **`packages/logic/src/hooks/`**. Never dump single-feature hooks into `packages/logic`.
- **Components**: App-specific UI lives in **`apps/web/src/components`** (`layout/` for shell pieces, `providers/` for context, feature folders for domain UI). Reusable, presentation-only primitives live in **`packages/ui/src`**.
- **Layouts**: Use **Next.js layout files** under **`apps/web/src/app`** to describe **structural shells** (marketing vs authenticated app, sidebars, shared chrome). **`apps/web/src/app/layout.tsx`** should remain the root document shell; nested layouts in route groups define **layout providers** and persistent UI around route segments—keep auth, data bootstrapping, and shell composition there rather than scattering it across every page.
- **Providers and motion**: Prefer **providers** (`apps/web/src/components/providers`) for cross-cutting client concerns (theme, Convex, toasts). For **motion and enter/exit animations** that must wrap subtrees or coordinate with React lifecycle, implement them **inside providers** or small provider-adjacent client components—use **Framer Motion** when you need a mature animation API, or **CSS / Motion** (or other well-supported options) when a lighter approach fits; pick one consistent strategy per feature and avoid ad hoc globals.
- **App directory**: Keep **`apps/web/src/app`** **neat and route-group–aware**: mirror the folder structure with clear `(segment)` groups, colocate `page.tsx`, `loading.tsx`, and segment `layout.tsx` where they belong, and avoid dumping large component trees into pages—**compose from `apps/web/src/components`**, **`@wryte/ui`**, and **`@wryte/logic`** instead.

## Tooling and workflow

- **Package manager**: Use **Bun only** (`bun run …`, `bun x …`). Do not introduce other package managers or replace the existing toolchain.
- **Task runner**: **Turborepo**. `bun run dev` starts every workspace's dev task at once; `bun run dev:web`, `bun run dev:convex`, and `bun run dev:desktop` start one. Convex commands must run inside `packages/backend`.
- **Dev server**: Assume **`bun run dev`** is already running unless you are told otherwise. Do not start or restart it unless explicitly requested.
- **After substantive changes**, verify the tree:
  1. **`bun run lint`** — Biome check across the whole repo (run from the root).
  2. **`bun run format`** — Biome write (format).
  3. **`bun run type`** — `turbo run type`, which typechecks every workspace (resolve all type errors before finishing).

Stop with the fucking builing up the project, I will build the project myself, and the dev server is running all the time, constantly, so stop fucking building the server again and again and again and wasting tokens. If you want to verify that it is working or not, just run the `bun run lint` command or the type check to make sure that it is up to the quality standards.
