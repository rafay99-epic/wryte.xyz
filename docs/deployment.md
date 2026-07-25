# Deployment

Three things ship independently: the web app (Vercel), the Convex backend, and
the desktop app (GitHub Releases + Homebrew).

## Web — Vercel

### Project settings

One dashboard setting is required, because Vercel resolves the Next.js version
from the package.json at the project's **Root Directory**, and the root manifest
holds only tooling:

- **Root Directory**: `apps/web`
- **Include files outside the Root Directory in the Build Step**: enabled, so
  `packages/` is uploaded

Pointing it at the repo root fails with:

```
Error: No Next.js version detected. Make sure your package.json has "next" in
either "dependencies" or "devDependencies".
```

### Build contract

Everything else is declarative in `apps/web/vercel.json` — Vercel reads
`vercel.json` from the Root Directory, which is why the file lives there and not
at the repo root:

```json
{
  "framework": "nextjs",
  "installCommand": "cd ../.. && bun install",
  "buildCommand": "cd ../.. && bun run build:deploy"
}
```

Both commands step back to the workspace root: `bun install` there resolves
every workspace, and `build:deploy` runs

```
convex deploy --cmd-url-env-var-name NEXT_PUBLIC_CONVEX_URL \
              --cmd 'cd ../../apps/web && bun run build'
```

from `packages/backend`. Convex deploys first, then its URL is injected into the
Next build. `outputDirectory` is deliberately omitted — the default `.next` is
already relative to the Root Directory.

Git deployments are disabled (`git.deploymentEnabled: false`); CI drives
`vercel deploy --prod` instead.

### Environment variables

Set in the Vercel project, not in `vercel.json`:

`NEXT_PUBLIC_CONVEX_URL` is injected by `convex deploy`. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, and the optional Rollbar tokens must be configured on the
project.

## Backend — Convex

`convex deploy` runs as part of the web build, so the backend ships with the
frontend that expects it. To deploy on its own:

```bash
cd packages/backend
bunx convex deploy
```

Deployment env vars (`CLERK_JWT_ISSUER_DOMAIN`, `CLERK_SECRET_KEY`,
`WORKOS_API_KEY`) live on the Convex deployment itself — see
[setup.md](setup.md#set-on-the-convex-deployment).

## Desktop — GitHub Releases + Homebrew

Releases are cut by CI, not by hand. A push to `main` touching `apps/desktop/`
builds macOS and Windows artifacts, publishes a GitHub release, and bumps the
Homebrew cask. Full job breakdown in [ci.md](ci.md#desktop-path).

Version is `<major.minor from apps/desktop/package.json>.<run number>`. To move
the series, bump the major/minor in `apps/desktop/package.json` — the patch is
CI's run number and increases on its own.

> `apps/desktop/package.json` and `apps/web/package.json` carry independent
> versions now. The desktop one drives releases and the cask; the web one
> surfaces as `NEXT_PUBLIC_APP_VERSION`. Bump the one you mean.

### Installing

```bash
brew install --cask rafay99-epic/apps/wryte
```

Or download the `.dmg` / `.exe` from
[Releases](https://github.com/rafay99-epic/wryte.xyz/releases).

### Building locally

```bash
bun run desktop:pack    # unpacked, fast sanity check
bun run desktop:dist    # full installers
```

macOS builds are unsigned by default (`identity: null`). Signing happens in
`apps/desktop/afterpack-sign.cjs`.

## Release checklist

1. Open a PR — CI runs both quality gates with no side effects.
2. Green? Merge.
3. Website path deploys to Vercel automatically.
4. Desktop path publishes the release and bumps the cask automatically.
5. Verify the release at
   [Releases](https://github.com/rafay99-epic/wryte.xyz/releases) and confirm
   the cask commit landed in the tap.
