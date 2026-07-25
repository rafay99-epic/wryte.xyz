# Monorepo migration notes

The repo moved from a single Next.js package to **Bun workspaces + Turborepo**.
Everything below is either a one-time manual step or a gotcha worth knowing.

## Layout

| Workspace | Package name | What lives there |
|-----------|--------------|------------------|
| `apps/web` | `@wryte/web` | Next.js app, Playwright e2e, release scripts |
| `apps/desktop` | `@wryte/desktop` | Electron shell + electron-builder config |
| `packages/ui` | `@wryte/ui` | Presentational primitives (one component per file) |
| `packages/logic` | `@wryte/logic` | `lib/`, `hooks/`, `stores/`, `types/` |
| `packages/backend` | `@wryte/backend` | All Convex functions and schema |

Dependencies flow one way: `apps/web` → `@wryte/ui` → `@wryte/logic` → `@wryte/backend`.

Packages are consumed as **untranspiled TypeScript source** via `exports`
wildcards (`@wryte/ui/button` → `packages/ui/src/button.tsx`). Next compiles
them through `transpilePackages` in `apps/web/next.config.ts`. There is no
build step for a package, and no `dist/` to keep in sync.

## One-time manual steps

### 1. Environment files

`.env.local` still lives at the repo root. Next.js and the Convex CLI each read
it from their own working directory, so both workspaces get a symlink to it:

```bash
bun run link-env
```

Symlinks are gitignored, so run this once after a fresh clone.

### 2. Vercel

**Root Directory must be `apps/web`** (Settings → Build & Deployment), with
"Include files outside the Root Directory in the Build Step" left enabled.
This is the one setting `vercel.json` cannot express — Vercel resolves the
Next.js version from the package.json at the Root Directory, and the root
manifest holds only tooling. Pointing it at the repo root fails with:

```
Error: No Next.js version detected. Make sure your package.json has "next" in
either "dependencies" or "devDependencies".
```

Everything else lives in `apps/web/vercel.json` — Vercel reads `vercel.json`
from the Root Directory, which is why the file sits there and not at the repo
root:

```json
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && bun install",
  "buildCommand": "cd ../.. && bun run build:deploy"
}
```

Both commands step back to the workspace root: `bun install` there resolves
every workspace, and `build:deploy` runs `convex deploy` inside
`packages/backend` with `--cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL`, whose
`--cmd` builds the web app. Convex ships before Next is compiled against its
URL, same ordering as before the split. `outputDirectory` is omitted on
purpose: the default `.next` is already relative to the Root Directory.

### 3. Local Convex deployment state

If you run `convex dev --local`, its state directory moved from `.convex/` at
the repo root to `packages/backend/.convex/`. The existing local deployment was
moved with it — no reconfiguration needed.

## Gotchas

- **Convex CLI**: run every `convex …` command from `packages/backend` (or use
  `bun run dev:convex`). From the repo root it cannot find `convex/`.
- **Tailwind**: `apps/web/src/app/globals.css` declares `@source` entries for
  `packages/ui/src` and `packages/logic/src`. Tailwind's automatic source
  detection stops at the app directory — a new shared package needs a new
  `@source` line or its classes get purged from production CSS.
- **Version numbers**: the desktop app version lives in
  `apps/desktop/package.json` (read by CI and electron-builder); the web app
  version lives in `apps/web/package.json` (surfaced as
  `NEXT_PUBLIC_APP_VERSION`). They are independent now — bump the one you mean.
- **Adding a shadcn component**: `components.json` still points at
  `apps/web/src/components/ui`. Generated primitives land there; move them to
  `packages/ui/src` if they are genuinely shared.
- **Dependency audit**: the `minimumReleaseAge` gate in `bunfig.toml` is gone —
  it was holding back the security patches it existed to let through. CI runs a
  bare `bun audit` with no ignore list; keep it that way, and fix advisories by
  bumping rather than by adding exceptions.
- **New dependency**: add it to the workspace that imports it, not the root.
  The root `package.json` only holds tooling (Biome, TypeScript, Turbo) plus
  Bun-only fields that must stay at the root (`overrides`,
  `patchedDependencies`, `trustedDependencies`).
