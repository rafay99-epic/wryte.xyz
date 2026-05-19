@AGENTS.md

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
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
- **Hooks**: **Colocate hooks with their feature.** Feature-specific hooks live in a `hooks/` subfolder inside the feature or component directory that owns them (e.g. `src/features/editor/hooks/`, `src/features/content-dashboard/hooks/`, `src/components/layout/hooks/`). Only **truly shared** hooks — used by two or more **unrelated** features — belong in **`src/hooks/`**. Never dump single-feature hooks into the top-level `src/hooks/` directory. Pages and components should stay thin and delegate to hooks where logic would otherwise be duplicated or hard to test.
- **Components**: Define **UI building blocks** in **`src/components`**. Use `components/ui` for primitives and shared UI, `components/layout` for shell pieces (header, sidebar, navigation), `components/providers` for context and app-wide wrappers, and feature folders (for example `components/editor`) for domain-specific UI.
- **Layouts**: Use **Next.js layout files** under **`src/app`** to describe **structural shells** (marketing vs authenticated app, sidebars, shared chrome). **`src/app/layout.tsx`** should remain the root document shell; nested layouts in route groups define **layout providers** and persistent UI around route segments—keep auth, data bootstrapping, and shell composition there rather than scattering it across every page.
- **Providers and motion**: Prefer **providers** (`src/components/providers`) for cross-cutting client concerns (theme, Convex, toasts). For **motion and enter/exit animations** that must wrap subtrees or coordinate with React lifecycle, implement them **inside providers** or small provider-adjacent client components—use **Framer Motion** when you need a mature animation API, or **CSS / Motion** (or other well-supported options) when a lighter approach fits; pick one consistent strategy per feature and avoid ad hoc globals.
- **App directory**: Keep **`src/app`** **neat and route-group–aware**: mirror the folder structure with clear `(segment)` groups, colocate `page.tsx`, `loading.tsx`, and segment `layout.tsx` where they belong, and avoid dumping large component trees into pages—**compose from `src/components`** and **`src/hooks`** instead.

## Tooling and workflow

- **Package manager**: Use **Bun only** (`bun run …`, `bun x …`). Do not introduce other package managers or replace the existing toolchain.
- **Dev server**: Assume **`bun run dev`** is already running unless you are told otherwise. Do not start or restart it unless explicitly requested, or when required after a TinaCMS config/schema change.
- **After substantive changes**, verify the tree:
  1. **`bun run lint`** — Biome check (lint).
  2. **`bun run format`** — Biome write (format).
  3. **`bun run type`** — TypeScript `tsc --noEmit` (resolve all type errors before finishing).

Stop with the fucking builing up the project, I will build the project myself, and the dev server is running all the time, constantly, so stop fucking building the server again and again and again and wasting tokens. If you want to verify that it is working or not, just run the `bun run lint` command or the type check to make sure that it is up to the quality standards.
