# Setup

## Prerequisites

- [Bun](https://bun.sh) 1.3.11+ — package manager and runtime, the only one this repo uses
- A [Convex](https://convex.dev) account and project
- A [Clerk](https://clerk.com) application for authentication
- Node.js 22+ — only needed if you build the Electron desktop app

## Quick start

```bash
git clone https://github.com/rafay99-epic/wryte.xyz.git
cd wryte.xyz

bun install

cp .env.local.example .env.local   # fill in your values
bun run link-env                   # symlink it into the workspaces

bun run dev
```

The web app is at [http://localhost:3000](http://localhost:3000).

## Environment variables

One `.env.local` lives at the **repo root**. Next.js and the Convex CLI each
read it from their own working directory, so both workspaces get a symlink:

```
apps/web/.env.local          → ../../.env.local
packages/backend/.env.local  → ../../.env.local
```

`bun run link-env` creates both. Symlinks are gitignored, so run it once after
a fresh clone. `.env.local.example` is the annotated template.

### Read by Next.js

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key, server-side |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route, defaults to `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route, defaults to `/sign-up` |
| `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` | Error tracking, optional |
| `ROLLBAR_SERVER_TOKEN` | Error tracking, optional |

### Set on the Convex deployment

These are **not** read by Next.js. Set them with `convex env set` from
`packages/backend`:

```bash
cd packages/backend
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-app.clerk.accounts.dev
```

| Variable | Description |
|----------|-------------|
| `CLERK_JWT_ISSUER_DOMAIN` | JWT issuer Convex verifies sessions against |
| `CLERK_SECRET_KEY` | Same value as above — fetches fresh GitHub OAuth tokens server-side |
| `WORKOS_API_KEY` | WorkOS Vault — encrypts user-supplied GitHub PATs and AI credentials |
| `ROLLBAR_SERVER_TOKEN` | Error tracking in Convex Node actions, optional |

> **Not env vars:** AI provider keys (Anthropic / OpenAI / OpenRouter) and media
> keys (Cloudinary / UploadThing) are configured per project by each user in
> **Project Settings**. They are encrypted in WorkOS Vault and read per request —
> never stored in the database or in environment variables.

## Convex CLI

All Convex commands run from `packages/backend`:

```bash
cd packages/backend
bunx convex dev          # or: bun run dev:convex from the repo root
bunx convex codegen
bunx convex env list
```

From the repo root the CLI cannot find `convex/` and fails with
`Failed to load deployment config`.

If you use a local deployment (`convex dev --local`), its state lives in
`packages/backend/.convex/`.

## Verifying the tree

After any substantive change:

```bash
bun run lint     # Biome, whole repo
bun run type     # turbo run type — every workspace
bun run test     # turbo run test
```

Full command reference: [commands.md](commands.md).
