# CI / CD

GitHub Actions. Two workflows in `.github/workflows/`.

## `ci-cd.yml` — the pipeline

Runs on push to `main`, on pull requests, and on manual dispatch. Concurrency
is keyed per ref with `cancel-in-progress`, so a new push supersedes the run
it interrupted.

### Change detection

A `detect` job diffs `HEAD~1..HEAD` and sets two outputs. Manual dispatch and
shallow history both force everything on.

| Changed path | Triggers |
|--------------|----------|
| `apps/web/`, `packages/`, `turbo.json`, `tsconfig.base.json`, `biome.json`, root manifests, the workflow itself | website path |
| `apps/desktop/`, root manifests, `patches/`, `turbo.json`, the workflow itself | desktop path |

Both paths run in parallel when both matched — which is what a monorepo-wide
change does.

### Website path

```
detect → quality-website → deploy-website
```

- **quality-website** — `bun install --frozen-lockfile`, `bun run lint`, `bun run type`
- **deploy-website** — `vercel pull` then `vercel deploy --prod`. Skipped on
  pull requests.

Vercel's own build runs `bun run build:deploy`, which deploys Convex before
building Next. See [deployment.md](deployment.md).

### Desktop path

```
detect → quality-desktop → prepare-release → build-desktop (macOS, Windows) → finalize-desktop
```

- **quality-desktop** — lint, type, and `bun audit`. The audit has **no ignore
  list**; fix advisories by bumping, not by adding exceptions.
- **prepare-release** — derives the version as
  `<major.minor from apps/desktop/package.json>.<GITHUB_RUN_NUMBER>`, e.g.
  `1.3.32`, and opens a draft release tagged `v1.3.32`. Skipped on pull requests.
- **build-desktop** — matrix over `macos-latest` and `windows-latest`. Installs
  the Electron binary explicitly (`node apps/desktop/node_modules/electron/install.js`),
  then runs `electron-builder --publish always` from `apps/desktop`.
- **finalize-desktop** — flips the draft to latest and bumps the Homebrew cask
  in `rafay99-epic/homebrew-apps` via `.github/scripts/bump-cask.sh`.

The patch component is `GITHUB_RUN_NUMBER`, which only ever increases. That
makes the version mathematically unable to regress, so `electron-updater`
always fires and the cask always moves forward. The tag must stay exactly
`v${VERSION}` — electron-builder derives its release tag from the app version,
and the cask downloads from `…/releases/download/v${version}/Wryte.dmg`.

### What a pull request runs

Only `quality-website` and `quality-desktop`. `deploy-website`,
`prepare-release`, and `finalize-desktop` are gated on
`github.event_name != 'pull_request'`, and `build-desktop` needs
`prepare-release`, so an unmet dependency skips it too.

**Open a PR before merging anything structural.** It is a full dry run of both
quality gates with no deploy, no release, and no cask bump.

### What a merge to main sets in motion

If both paths matched, merging publishes a GitHub release and commits to the
Homebrew tap. Reverting the merge undoes neither — those need `gh release delete`
and a revert in the tap repo. Worth knowing before, not after.

## `dependency-check.yml` — weekly audit

Every Monday at 09:00 UTC, plus manual dispatch. Runs `bun outdated` and
`bun audit`, then opens or updates a GitHub issue with the results. Advisory
only — it never fails the build.

## Local equivalents

Before pushing, these cover the same ground the quality jobs do:

```bash
bun run lint
bun run type
bun audit
```
