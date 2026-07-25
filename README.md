<p align="center">
  <img src="public/product_logo/wryte-wordmark.png" alt="Wryte" width="480" />
</p>

<p align="center">
  <strong>Write Now, Publish Later</strong><br/>
  An editor-first content workflow tool for developers.
</p>

<p align="center">
  <a href="https://wryte.xyz">Website</a> &middot;
  <a href="https://wryte.xyz/how-it-works">How It Works</a> &middot;
  <a href="https://wryte.xyz/contact">Contact</a> &middot;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.1-amber" alt="Version" />
  <img src="https://img.shields.io/github/license/rafay99-epic/wryte.xyz" alt="License" />
  <img src="https://img.shields.io/badge/next.js-16-black" alt="Next.js" />
  <img src="https://img.shields.io/badge/convex-backend-purple" alt="Convex" />
</p>

---

## What is Wryte?

Wryte is a writing workspace for developers who publish content to GitHub-backed blogs and sites. Capture rough ideas in a markdown editor, organize them on a kanban board, refine with AI, and publish as clean commits to any GitHub repo — on demand or on a schedule.

**No vendor lock-in.** You bring your own API keys (AI, media, GitHub). Wryte never proxies or stores your usage — keys are encrypted in WorkOS Vault and read per-request.

---

## Features

- **Markdown editor** — Distraction-free writing with live preview and syntax highlighting
- **Kanban board** — Organize articles across Draft, In Review, Scheduled, and Published columns
- **GitHub publishing** — One-click or scheduled publishing as clean commits to any repo/branch
- **AI assistance** — Schema-driven frontmatter suggestions, content refinement (Anthropic, OpenAI, OpenRouter — BYOK)
- **Media management** — Upload and manage images via Cloudinary or UploadThing
- **Multi-project workspaces** — Separate projects with independent settings, repos, and content
- **Calendar view** — Visualize your publishing schedule at a glance
- **Scheduling workflows** — Durable scheduled publishes with retries and conflict resolution
- **In-app support** — Built-in contact and ticket system

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router, React 19) |
| **Backend** | [Convex](https://convex.dev) (real-time database, serverless functions, workflows) |
| **Auth** | [Clerk](https://clerk.com) |
| **Secrets** | [WorkOS Vault](https://workos.com) (encrypts user-supplied API keys) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com), [Framer Motion](https://motion.dev) |
| **UI** | [Base UI](https://base-ui.com), shadcn-style components |
| **Lint / Format** | [Biome](https://biomejs.dev) |
| **Package Manager** | [Bun](https://bun.sh) |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (package manager and runtime)
- [Convex](https://convex.dev) account and CLI
- [Clerk](https://clerk.com) application for authentication

### 1. Clone the repo

```bash
git clone https://github.com/rafay99-epic/wryte.xyz.git
cd wryte.xyz
```

### 2. Install dependencies

```bash
bun install
```

### 3. Configure environment variables

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

#### Next.js (`.env.local`)

| Variable | Description |
|----------|------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key (server-side) |

#### Convex (set via `npx convex env set`)

| Variable | Description |
|----------|------------|
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer domain for token verification |
| `CLERK_SECRET_KEY` | Same Clerk secret — used for GitHub OAuth token refresh |
| `WORKOS_API_KEY` | WorkOS Vault API key — encrypts user-supplied secrets |

> **Note:** AI provider keys (Anthropic / OpenAI / OpenRouter) and media keys (Cloudinary / UploadThing) are configured per-project by each user in **Project Settings**. They are never stored as env vars — they're encrypted in WorkOS Vault and read per-request.

### 4. Start the dev server

```bash
bun run dev
```

Turborepo runs every workspace's `dev` task in parallel — Next.js, `convex dev`,
and the Electron shell. The app is at [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | Description |
|---------|------------|
| `bun run dev` | All workspaces in parallel (web + Convex + desktop) |
| `bun run dev:web` | Next.js only |
| `bun run dev:convex` | Convex only |
| `bun run dev:desktop` | Electron shell only |
| `bun run build` | `turbo run build` across workspaces |
| `bun run build:deploy` | Convex deploy + Next.js build (used by Vercel) |
| `bun run start` | Start the production Next.js server |
| `bun run lint` | Biome check (lint + format consistency), whole repo |
| `bun run format` | Biome format with write |
| `bun run type` | `turbo run type` — typecheck every workspace |
| `bun run test` | `turbo run test` — unit tests per workspace |
| `bun run test:e2e` | Playwright end-to-end suite |
| `bun run desktop:dist` | Build the Electron installers |

Workspace-scoped commands work too: `bun run --filter @wryte/web <script>`.
Convex CLI commands must be run from `packages/backend`.

---

## Project Structure

```
wryte.xyz/                        # Bun workspaces + Turborepo
├── apps/
│   ├── web/                      # @wryte/web — Next.js App Router
│   │   ├── src/app/              #   Routes: (marketing) public, (app) authenticated
│   │   ├── src/components/       #   App-specific UI (layout, providers, dialogs)
│   │   ├── src/features/         #   Feature modules (editor, dashboard, calendar…)
│   │   ├── e2e/                  #   Playwright specs
│   │   └── public/               #   Static assets
│   └── desktop/                  # @wryte/desktop — Electron shell
│       ├── main.cjs              #   Entry point (app lifecycle, IPC wiring)
│       ├── src/                  #   window / menu / tray / updater / workers
│       └── electron-builder.js   #   Packaging config
├── packages/
│   ├── ui/                       # @wryte/ui — presentational primitives
│   │   └── src/                  #   button, dialog, select… (one per file)
│   ├── logic/                    # @wryte/logic — shared non-UI logic
│   │   └── src/{lib,hooks,stores,types}/
│   └── backend/                  # @wryte/backend — Convex
│       └── convex/
│           ├── cms/              #   Content management (projects, documents)
│           ├── media/            #   Media uploads and management
│           ├── ai/               #   AI provider integrations
│           ├── integrations/     #   GitHub, Clerk, secret store
│           ├── support/          #   Support ticket system
│           ├── account/          #   User settings and preferences
│           ├── _lib/             #   Shared utilities (auth, validation)
│           └── schema.ts         #   Database schema
├── turbo.json                    # Task graph
└── tsconfig.base.json            # Shared TypeScript options
```

### Import rules

| From | Use |
|------|-----|
| Inside `apps/web` | `@/…` for app-local files |
| Shared primitives | `@wryte/ui/button` |
| Shared logic | `@wryte/logic/lib/utils`, `@wryte/logic/stores/editor-store` |
| Convex API/types | `@wryte/backend/_generated/api`, `@wryte/backend/_generated/dataModel` |

Dependencies flow one way: `apps/web` → `@wryte/ui` → `@wryte/logic` → `@wryte/backend`.

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on pushes and PRs to `main`:

1. Install dependencies (`bun install`)
2. Biome lint and format check
3. TypeScript type check
4. `bun audit` for dependency vulnerabilities
5. Production build (with placeholder env vars)

---

## Contributing

We welcome contributions! Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Credits

Built by [Abdul Rafay](https://rafay99.com)

A product of [Syntax Lab Technology](https://syntaxlabtechnology.com)
