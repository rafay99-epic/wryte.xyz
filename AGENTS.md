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
- **No comments**: Source code carries **no comments** and **no JSDoc**. Names and types carry the meaning. The only allowed comments are tool directives that change behavior: `biome-ignore <rule>: <reason>` and `/// <reference lib="..." />` in Web Workers. Never add explanatory, TODO, or section-divider comments in TS, TSX, JS, CJS, CSS, or HTML.
- **Workspace boundaries**: This is a Bun + Turborepo monorepo. Put code where it belongs and never reach across a boundary with a relative path. Always use the package name.
  - `apps/web`: the Next.js app. Routes (`src/app`), features (`src/features`: React components and feature hooks), app-specific components (`src/components`). Internal imports use the `@/*` alias.
  - `apps/desktop`: the Electron shell (CommonJS, `main.cjs` + `src/`). It loads the deployed web app and must not import from `apps/web`. It is plain JavaScript typechecked with `checkJs` through `apps/desktop/tsconfig.json`, so types come from inference; do not add JSDoc.
  - `packages/ui` (`@wryte/ui`): presentational primitives only. One component per file, imported as `@wryte/ui/<file>`. No Convex calls, no feature logic, no domain rules.
  - `packages/logic` (`@wryte/logic`): **all non-UI logic lives here**: pure functions, parsers, formatters, lint and analysis rules, Web Worker clients, framework-free DOM helpers, Zustand stores, and shared types. Group by area under `src/lib/<area>/` (for example `lib/editor/`, `lib/readability/`, `lib/animations/`, `lib/dom/`, `lib/frontmatter-detection/`), plus `src/hooks/`, `src/stores/`, `src/types/`. Imported as `@wryte/logic/lib/editor/outline` etc. The package exports `./src/*.ts`, so it holds **`.ts` files only**: no JSX or components. It stays framework-light: no `next/*`, no `@clerk/nextjs`, no icon libraries. May depend on `@wryte/backend`, never on `@wryte/ui` or `apps/*`.
  - `packages/backend` (`@wryte/backend`): all Convex functions and schema. Consumers import `@wryte/backend/_generated/api` and `@wryte/backend/_generated/dataModel`. The animation checker in `convex/_lib/animationChecker/` is shared by the gallery Web Worker and the MCP upsert action; it needs the TypeScript 6 compiler API, installed as the `typescript6` alias, while the repo's own `tsc` stays TypeScript 7.
  - Dependency direction is one-way: `apps/web` → `@wryte/ui` → `@wryte/logic` → `@wryte/backend`. A new import that reverses it is a design bug, not a config problem.
  - **What may stay in `apps/web`** instead of `@wryte/logic`: code that needs a web-only dependency. Today that is icon-bearing constants (lucide tabs and slash commands), the animation checker's Web Worker client in `features/editor/lib/animations/checks/`, the `node:fs` loaders for docs and changelog, and Next server helpers such as `src/app/api/github/_lib/`. Everything else goes to `@wryte/logic`.
- **Hooks**: **Colocate hooks with their feature.** Feature-specific hooks live in a `hooks/` subfolder inside the feature or component directory that owns them (e.g. `apps/web/src/features/editor/hooks/`, `apps/web/src/components/layout/hooks/`). Hooks used by two or more **unrelated** features go in **`packages/logic/src/hooks/`**. Never dump single-feature hooks into `packages/logic`. When a hook's only consumer moves, move the hook with it.
- **Components**: App-specific UI lives in **`apps/web/src/components`** (`layout/` for shell pieces, `providers/` for context, feature folders for domain UI). Reusable, presentation-only primitives live in **`packages/ui/src`**. Do not export helper functions from component files; put them in `@wryte/logic`.
- **Layouts**: Use **Next.js layout files** under **`apps/web/src/app`** to describe **structural shells** (marketing vs authenticated app, sidebars, shared chrome). **`apps/web/src/app/layout.tsx`** should remain the root document shell; nested layouts in route groups define **layout providers** and persistent UI around route segments. Keep auth, data bootstrapping, and shell composition there rather than scattering it across every page. In the `(app)` layout the sidebar, header, and command palette mount only after `useConvexAuth()` reports authenticated. The page segment (`children`) must always render, because Next's instant-navigation validation reports a gated page as dropped; queries that require a signed-in user go through `useAuthedQuery` (`@wryte/logic/hooks/use-authed-query`), which skips them until Convex auth is established, and the `(app)` error boundaries retry anything that still fails through `usePreAuthRetry`. Never gate `children` on auth.
- **Providers and motion**: Prefer **providers** (`apps/web/src/components/providers`) for cross-cutting client concerns (theme, Convex, toasts). For **motion and enter/exit animations** that must wrap subtrees or coordinate with React lifecycle, implement them **inside providers** or small provider-adjacent client components. Use **Framer Motion** when you need a mature animation API, or **CSS / Motion** when a lighter approach fits; pick one consistent strategy per feature and avoid ad hoc globals.
- **App directory**: Keep **`apps/web/src/app`** **neat and route-group aware**: mirror the folder structure with clear `(segment)` groups, colocate `page.tsx`, `loading.tsx`, and segment `layout.tsx` where they belong, and avoid dumping large component trees into pages. **Compose from `apps/web/src/components`**, **`@wryte/ui`**, and **`@wryte/logic`** instead.

## Type safety

- Every workspace extends `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `verbatimModuleSyntax`, and more). The Convex config extends it too. Desktop relaxes only `noImplicitAny` and `exactOptionalPropertyTypes`.
- No `any`, no `as unknown as`, no non-null assertions to silence the compiler, no `@ts-ignore`. Fix the type instead. The one allowed cast is the Web Worker scope in `worker.ts` files (`self as unknown as DedicatedWorkerGlobalScope`), because the DOM lib is also loaded.
- Convex validators are typed end to end: no `v.any()`. Workpool and workflow callbacks use the validators those packages export (`vOnCompleteArgs`, `vWorkflowId`, `vResultValidator`).
- `bun run type` covers every workspace: web (including Next's generated route types), desktop, ui, logic and its tests, backend and its tests. When you add a new folder of TS or JS files, make sure a tsconfig includes it.

## Tooling and workflow

- **Package manager**: Use **Bun only** (`bun run …`, `bun x …`). Do not introduce other package managers or replace the existing toolchain.
- **Task runner**: **Turborepo**. `bun run dev` starts every workspace's dev task at once; `bun run dev:web`, `bun run dev:convex`, and `bun run dev:desktop` start one. Convex commands must run inside `packages/backend`.
- **Convex runs locally.** Development uses the local Convex deployment (`CONVEX_DEPLOYMENT=local:...` in `.env.local`). Never point development, tests, or scripts at the cloud or production deployment.
- **Dev server**: Assume **`bun run dev`** is already running unless you are told otherwise. Do not start or restart it unless explicitly requested.
- **After substantive changes**, verify the tree:
  1. **`bun run lint`**: Biome check across the whole repo (run from the root).
  2. **`bun run format`**: Biome write (format).
  3. **`bun run type`**: `turbo run type`, which typechecks every workspace (resolve all type errors before finishing).
  4. **`bun run test`**: unit suites in `packages/logic/tests` and `packages/backend/tests`. Unit tests for logic live next to it in `packages/logic/tests`.
- **MCP server**: `bun run test:mcp` runs the end-to-end MCP suite against the local Convex deployment through the real `/mcp` endpoint, with a Clerk session token minted for a local test user. It refuses to run against anything but local Convex and a `sk_test_` Clerk key. `MCP_E2E_USER_EMAIL` and `MCP_E2E_PROJECT_ID` pick the account and project; `MCP_E2E_MEDIA=1` adds a real upload to the project's media provider.
- **UI changes**: verify in the **T3 Code browser** against the running dev server (`http://localhost:3000`). For flows the browser can't reach, `bun run test:e2e` runs the Playwright suite against the running app.

Stop with the fucking builing up the project, I will build the project myself, and the dev server is running all the time, constantly, so stop fucking building the server again and again and again and wasting tokens. If you want to verify that it is working or not, just run the `bun run lint` command or the type check to make sure that it is up to the quality standards.
