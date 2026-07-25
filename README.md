<p align="center">
  <img src="apps/web/public/product_logo/wryte-wordmark.png" alt="Wryte" width="480" />
</p>

<p align="center"><strong>Write now, publish later — an editor-first content workflow for developers.</strong></p>

<p align="center">
  <a href="https://wryte.xyz">Website</a> &middot;
  <a href="https://wryte.xyz/how-it-works">How it works</a> &middot;
  <a href="https://wryte.xyz/changelog">Changelog</a> &middot;
  <a href="https://wryte.xyz/feature-requests">Roadmap</a> &middot;
  <a href="https://github.com/rafay99-epic/wryte.xyz/issues/new">Report a bug</a>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-22c55e?style=flat-square" alt="License: MIT" /></a>
  <a href="https://github.com/rafay99-epic/wryte.xyz/actions/workflows/ci-cd.yml"><img src="https://img.shields.io/github/actions/workflow/status/rafay99-epic/wryte.xyz/ci-cd.yml?branch=main&style=flat-square&logo=githubactions&logoColor=white&label=CI" alt="CI" /></a>
  <a href="https://github.com/rafay99-epic/wryte.xyz/releases/latest"><img src="https://img.shields.io/github/v/release/rafay99-epic/wryte.xyz?style=flat-square&logo=github&logoColor=white&label=desktop" alt="Latest release" /></a>
  <a href="./CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-3b82f6?style=flat-square" alt="PRs welcome" /></a>
  <img src="https://img.shields.io/badge/next.js-16-black?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/convex-backend-8b5cf6?style=flat-square" alt="Convex" />
</p>

Most developer blogs die in the gap between writing and shipping — a draft in
one tool, frontmatter in another, and a manual commit to remember. Wryte closes
it: capture ideas in a markdown editor, move them across a kanban board, refine
with AI, and publish as clean commits to any GitHub repo — on demand or on a
schedule.

**No vendor lock-in.** You bring your own keys — AI, media, GitHub. Wryte never
proxies or meters your usage. Keys are encrypted in WorkOS Vault and read per
request; the database stores only reference IDs.

## Features

**Writing**

- Distraction-free markdown editor with live preview, split-scroll sync, and focus mode
- Sprint mode, readability analysis, and style linting
- Wiki links, backlinks, and an outline panel for building series
- Version snapshots with diff review before publishing

**Publishing**

- One-click or scheduled publishing as clean commits to any repo and branch
- Schema-driven frontmatter with per-framework detection (Astro, Hugo, Jekyll, Contentlayer)
- Pre-publish checklist: SEO, links, frontmatter validation
- Durable scheduled publishes with retries and conflict resolution

**Organising**

- Kanban board and table views with bulk actions, tags, and filters
- Publishing calendar, global and per project
- Multi-project workspaces with independent repos and settings
- Media library backed by Cloudinary or UploadThing

**AI, bring your own key**

- Frontmatter suggestions, inline rewriting, and content synthesis
- Anthropic, OpenAI, and OpenRouter — configured per project, never proxied

## Getting started

|                             Wryte Cloud                              |                                 Desktop app                                  |
| :------------------------------------------------------------------: | :--------------------------------------------------------------------------: |
| Nothing to install — [wryte.xyz](https://wryte.xyz) runs in the browser | `brew install --cask rafay99-epic/apps/wryte`, or grab a build from [Releases](https://github.com/rafay99-epic/wryte.xyz/releases) |

Running it yourself takes three commands:

```bash
git clone https://github.com/rafay99-epic/wryte.xyz.git && cd wryte.xyz
bun install
cp .env.local.example .env.local && bun run link-env
bun run dev
```

Full prerequisites and environment variables: [docs/setup.md](docs/setup.md).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org) — App Router, React 19 |
| Backend | [Convex](https://convex.dev) — real-time database, serverless functions, durable workflows |
| Desktop | [Electron](https://electronjs.org) with `electron-updater` |
| Auth | [Clerk](https://clerk.com) |
| Secrets | [WorkOS Vault](https://workos.com) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com), [Framer Motion](https://motion.dev) |
| UI | [Base UI](https://base-ui.com), shadcn-style components |
| Tooling | [Bun](https://bun.sh), [Turborepo](https://turbo.build), [Biome](https://biomejs.dev) |

## Security

Wryte holds credentials that reach your repositories, so the boring details
matter:

- GitHub tokens and AI provider keys are encrypted in WorkOS Vault; the database
  holds only vault reference IDs — never plaintext.
- Keys are resolved per request inside server-side Convex actions. They never
  reach the browser.
- Routes are protected by Clerk middleware; Convex verifies the JWT independently.
- `bun audit` runs in CI with **no ignore list** — advisories get fixed by
  bumping, not by exception.

Found a vulnerability? Please report it privately rather than opening a public
issue.

## Documentation

| Guide | Contents |
|-------|----------|
| [Setup](docs/setup.md) | Prerequisites, environment variables, Convex CLI |
| [Commands](docs/commands.md) | Dev, build, quality, test, desktop, Convex |
| [Project Structure](docs/structure.md) | Folder layout, feature modules, import rules |
| [Architecture](docs/architecture.md) | Workspace boundaries, data flow, conventions |
| [Desktop App](docs/desktop.md) | Electron shell, packaging, auto-update |
| [Deployment](docs/deployment.md) | Vercel, Convex, releases, Homebrew |
| [CI / CD](docs/ci.md) | GitHub Actions pipeline, both paths |

<details>
<summary><strong>Repo layout at a glance</strong></summary>

Wryte is a Bun + Turborepo monorepo — Next.js web app, Electron shell, Convex
backend, and two shared packages.

```
apps/
  web/            # @wryte/web      Next.js app, e2e, release scripts
  desktop/        # @wryte/desktop  Electron shell + electron-builder
packages/
  ui/             # @wryte/ui       Presentational primitives
  logic/          # @wryte/logic    lib / hooks / stores / types
  backend/        # @wryte/backend  Convex functions and schema
docs/             # Contributor documentation
```

Dependencies flow one way — `apps/web` → `@wryte/ui` → `@wryte/logic` →
`@wryte/backend`. Packages are consumed as TypeScript source through `exports`
wildcards, so there is no per-package build step and no `dist/` to keep in sync.

Detail: [docs/structure.md](docs/structure.md) and
[docs/architecture.md](docs/architecture.md).

</details>

## Contributing

Issues and PRs welcome — start with [CONTRIBUTING.md](CONTRIBUTING.md) for the
workflow and commit conventions. Open a PR rather than pushing to `main`: a PR
runs both CI quality gates with no deploy and no release.

## License

[MIT](./LICENSE) © Syntax Lab Technology and Abdul Rafay.

---

<p align="center">
  Built in the open &middot; <a href="https://wryte.xyz">wryte.xyz</a>
  <br />
  <sub>Developed at <a href="https://syntaxlabtechnology.com">Syntax Lab Technology</a> &middot; Lead dev <a href="https://rafay99.com">rafay99.com</a></sub>
</p>
