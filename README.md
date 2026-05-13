# Wryte

A writing workspace built with **Next.js** (App Router), **Convex**, and **Clerk**. Projects, markdown documents, optional GitHub publishing, scheduling workflows, and AI-assisted editing run on this stack.

## Prerequisites

- [Bun](https://bun.sh) (package manager and runtime for scripts)
- [Convex](https://convex.dev) account and CLI (`npx convex dev` is started by the dev script)
- [Clerk](https://clerk.com) application for authentication

## Quick start

Install dependencies:

```bash
bun install
```

Configure environment variables (see below), then start Next.js and the Convex dev deployment together:

```bash
bun run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Convex dashboard will prompt for login / project linking on first run.

## Environment variables

### Next.js (`.env.local`)

| Variable                            | Description                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL`            | Convex deployment URL (required at build and runtime for the React client). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key.                                                      |
| `CLERK_SECRET_KEY`                  | Clerk secret key (server-side).                                             |

### Convex (Convex dashboard → your deployment → Settings → Environment variables)

| Variable                  | Description                                                                     |
| ------------------------- | ------------------------------------------------------------------------------- |
| `CLERK_JWT_ISSUER_DOMAIN` | Clerk JWT issuer domain used in `convex/auth.config.ts` for token verification. |
| `WORKOS_API_KEY`          | WorkOS Vault API key — encrypts every user-supplied secret (AI provider keys, media provider keys, GitHub PAT). |

AI provider keys (Anthropic / OpenAI / OpenRouter) and media provider keys
(UploadThing / Cloudinary) are no longer environment variables. Each user
supplies their own keys in **Project Settings → AI** / **Project Settings →
Media**; they're stored encrypted in WorkOS Vault and read per-request. If
you previously set `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
`OPENROUTER_API_KEY` on a Convex deployment, they're safe to remove — no
code path reads them anymore.

## Scripts

| Command          | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `bun run dev`    | Runs **Next.js** and **`convex dev`** in parallel (via `concurrently`). |
| `bun run build`  | Production Next.js build.                                               |
| `bun run start`  | Start the production Next.js server (after `build`).                    |
| `bun run lint`   | Biome check (lint + format consistency).                                |
| `bun run format` | Biome format with write.                                                |
| `bun run type`   | TypeScript check (`tsc --noEmit`).                                      |

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs install, **Biome**, **TypeScript**, **`bun audit`**, and **`bun run build`** on pushes and pull requests to `main` / `master`. Build uses placeholder env vars so it does not require real secrets.

## Tooling

- **Lint / format:** [Biome](https://biomejs.dev)
- **UI:** React 19, Tailwind CSS v4, [Base UI](https://base-ui.com) / shadcn-style components
- **Repo conventions:** See `AGENTS.md` and `CLAUDE.md` for agent and Convex-oriented guidelines.

## License

Private project (see `package.json`).
