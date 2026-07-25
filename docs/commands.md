# Commands

Run everything from the repo root with `bun run`. Turborepo fans tasks out
across workspaces; `bun run --filter <package> <script>` targets one.

## Development

| Command | What it does |
|---------|-------------|
| `bun run dev` | Every workspace's dev task in parallel — Next.js, Convex, Electron |
| `bun run dev:web` | Next.js only |
| `bun run dev:convex` | Convex only |
| `bun run dev:desktop` | Electron shell only |

The Electron shell probes ports 3000–3002 and attaches to whichever dev server
answers, so `bun run dev:web` and `bun run dev:desktop` in two terminals works
fine.

## Build

| Command | What it does |
|---------|-------------|
| `bun run build` | `turbo run build` across workspaces |
| `bun run build:deploy` | Convex deploy, then Next.js build against the resulting URL — this is what Vercel runs |
| `bun run start` | Serve the production Next.js build |

## Quality

| Command | What it does |
|---------|-------------|
| `bun run lint` | Biome check across the whole repo |
| `bun run format` | Biome format with write |
| `bun run type` | `turbo run type` — typechecks every workspace |
| `bun audit` | Dependency vulnerability scan, no ignore list |

`bunx biome check --write` applies safe fixes, including import sorting.

## Testing

| Command | What it does |
|---------|-------------|
| `bun run test` | `turbo run test` — assertion suites in web and backend |
| `bun run test:e2e` | Playwright suite against a running app |
| `bun run test:e2e:ui` | Playwright UI mode |
| `bun run test:e2e:report` | Open the last HTML report |

Playwright has no `webServer` block on purpose — it assumes an app is already
running against a live Convex backend. Point it elsewhere with
`PLAYWRIGHT_BASE_URL=http://localhost:3001`.

## Desktop

| Command | What it does |
|---------|-------------|
| `bun run desktop:pack` | `electron-builder --dir` — unpacked app, fast sanity check |
| `bun run desktop:dist` | Full installers (dmg, zip, nsis) |
| `bun run --filter @wryte/desktop dev:pack` | Dev-flavour unpacked build |
| `bun run --filter @wryte/desktop dev:dist` | Dev-flavour installers |

Dev-flavour builds use appId `xyz.wryte.desktop.dev`, product name `Wryte Dev`,
and output to `dist-dev/` — they install side by side with the release build.

## Utilities

| Command | What it does |
|---------|-------------|
| `bun run link-env` | Symlink the root `.env.local` into web and backend |
| `bun run changelog:new` | Interactive changelog entry authoring |
| `bun run --filter @wryte/web stamp-version` | Write the current version into the deployment |

## Convex

Run from `packages/backend`, or use the root `dev:convex` script:

| Command | What it does |
|---------|-------------|
| `bunx convex dev` | Watch and push functions |
| `bunx convex dev --local` | Local deployment, state in `packages/backend/.convex/` |
| `bunx convex codegen` | Regenerate `_generated/` |
| `bunx convex env set KEY value` | Set a deployment env var |
| `bunx convex deploy` | Deploy to production |
