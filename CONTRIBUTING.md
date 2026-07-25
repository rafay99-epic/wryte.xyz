# Contributing to Wryte

Thanks for your interest in contributing to Wryte! This guide will help you get started.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Commit Messages](#commit-messages)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

For anything beyond the workflow itself — setup, commands, repo layout,
architecture, deployment — see the [documentation index](README.md#documentation).

---

## Code of Conduct

Be respectful, constructive, and inclusive. We're building something useful together — keep discussions focused on the work.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/wryte.xyz.git
   cd wryte.xyz
   ```
3. **Install dependencies:**
   ```bash
   bun install
   ```
4. **Set up environment variables:**
   ```bash
   cp .env.local.example .env.local   # fill in your values
   bun run link-env                   # symlink it into the workspaces
   ```
   Full variable reference: [docs/setup.md](docs/setup.md).
5. **Start the dev server:**
   ```bash
   bun run dev
   ```
   Turborepo runs the Next.js app, Convex, and the Electron shell in parallel.
   Convex CLI commands run from `packages/backend`.

---

## Development Workflow

### Branching

- Create a feature branch from `main`:
  ```bash
  git checkout -b feat/your-feature-name
  ```
- Use prefixes: `feat/`, `fix/`, `refactor/`, `docs/`, `chore/`

### Running checks

Before submitting a PR, make sure all checks pass:

```bash
bun run lint      # Biome check, whole repo
bun run format    # Biome format (auto-fix)
bun run type      # turbo run type — every workspace
bun audit         # dependency advisories, no ignore list
```

All must pass cleanly. CI will reject PRs with lint, format, type, or audit
errors. Full command reference: [docs/commands.md](docs/commands.md).

### Tooling

- **Package manager:** Bun only. Do not use npm, yarn, or pnpm.
- **Monorepo:** Bun workspaces + Turborepo. Know which workspace your change
  belongs in before you write it — see [docs/structure.md](docs/structure.md).
- **Lint / format:** [Biome](https://biomejs.dev) — configured in `biome.json`
- **TypeScript:** Strict mode with `exactOptionalPropertyTypes` enabled

---

## Pull Request Process

1. **One concern per PR** — keep PRs focused. A bug fix should not include unrelated refactoring.
2. **Write a clear description** — explain what changed and why. Link to any related issues.
3. **All checks must pass** — lint, format, type check, and CI build.
4. **No secrets** — never commit `.env.local`, API keys, or credentials. Use `.env.local.example` for documenting new env vars.
5. **Test your changes** — verify the golden path and edge cases in the browser before submitting.

### PR title format

Use conventional commit style:

```
feat: add calendar week view
fix: resolve publish race condition
refactor: extract shared auth hook
docs: update env variable table
```

---

## Code Style

### General

- Write clean, focused modules. Keep boundaries obvious between data layer, UI, and utilities.
- Prefer small functions over large ones. Extract shared logic — don't duplicate across files.
- No unnecessary comments. Code should be self-documenting. Only comment the **why** when it's non-obvious.

### Frontend

- **Components**: app-specific UI in `apps/web/src/components/` (`layout/` for shell pieces, feature folders for domain UI); reusable primitives in `packages/ui/src/`, imported as `@wryte/ui/<name>`.
- **Hooks**: colocate feature hooks next to the feature. Only hooks shared by unrelated features go in `packages/logic/src/hooks/` (`@wryte/logic/hooks/<name>`).
- **Pages** stay thin — compose from components and hooks, don't dump large trees into `page.tsx`.
- **Animations** use Framer Motion consistently. No ad-hoc CSS animation globals.

### Backend (Convex)

- All Convex code lives in `packages/backend/convex/`. Run Convex CLI commands from `packages/backend`.
- Read `packages/backend/convex/_generated/ai/guidelines.md` before writing Convex code — it has rules that override training data.
- Domain folders: `cms/`, `media/`, `ai/`, `integrations/`, `account/`, `support/`
- Shared utilities live in `convex/_lib/`
- Always bound query results with `.take(n)` — never return unbounded lists.

---

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `perf`, `ci`

**Scope** is optional but helpful: `editor`, `board`, `sync`, `ai`, `auth`, `sidebar`, etc.

**Examples:**

```
feat(editor): add word count to status bar
fix(sync): guard against race when cancelling scheduled publish
refactor(board): extract drag-and-drop into shared hook
docs: update contributing guidelines
```

---

## Reporting Bugs

Open an issue with:

1. **What happened** — describe the unexpected behavior
2. **What you expected** — describe the correct behavior
3. **Steps to reproduce** — minimal steps to trigger the bug
4. **Environment** — browser, OS, and any relevant config

Or use the in-app support form at **Settings > Support**.

---

## Requesting Features

Open an issue with:

1. **Problem** — what pain point are you solving?
2. **Proposed solution** — how would you approach it?
3. **Alternatives considered** — what else did you think about?

Keep feature requests focused. "Add X" is better than "redesign the entire Y system."

---

## Questions?

Reach out via the [contact form](https://wryte.xyz/contact) or open a discussion on GitHub.

Thanks for contributing!
