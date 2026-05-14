---
title: "Bun Patch: The Escape Hatch When an npm Package Doesn't Quite Do What You Need"
slug: bun-patch-npm-package-without-forking
description: "A five-minute, fork-free way to change someone else's npm package. Walks through bun patch end-to-end with a real example — patching a Convex component's hardcoded cron interval — including how it survives `bun install --frozen-lockfile`, how it deploys through CI, and when you should still fork or open an upstream PR instead."
date: 2026-05-14
author: "Abdul Rafay"
canonicalUrl: "https://wryte.xyz/blog/bun-patch-npm-package-without-forking"
ogImage: "/images/blog/bun-patch-cover.png"
twitterCard: "summary_large_image"

# SEO
keywords:
  - bun patch
  - bun patchedDependencies
  - patch npm package without forking
  - patch-package alternative
  - bun.lock patches
  - monkey patch dependency
  - bun install frozen lockfile patches
  - npm package customization
  - vendoring vs patching
  - convex component patch
seo:
  title: "How to Patch an npm Package Without Forking It — Bun Patch Guide"
  description: "A practical walkthrough of bun patch — modify any node_module, commit the diff, and have it auto-applied in CI. Includes a real Convex component example, the .patch format, and when to use this vs. forking."
  openGraph:
    type: article
    title: "Bun Patch: Edit Any Dependency Without Forking It"
    description: "5-minute workflow, survives clean installs, deploys through CI. Real example included."
    image: "/images/blog/bun-patch-cover.png"
  twitter:
    card: summary_large_image
    title: "Bun Patch — the escape hatch for npm dependencies"
    description: "Change one line in any package, commit the diff, never publish a fork."

imagePrompt: >
  A close-up photorealistic shot of a small fabric patch sewn onto a brown
  cardboard shipping box with the word "PACKAGE" stamped on it. The patch
  itself has subtle code-snippet stitching: visible characters like { hours:
  24 } woven into the embroidery. Soft natural lighting from the upper left,
  shallow depth of field. Warm tones, slight grain. 16:9 ratio. No other
  text on the image.

regenerationPrompt: >
  Rewrite as a practical, no-fluff developer guide. Keep the same structure:
  problem → bun patch workflow → CI considerations → when not to patch.
  Audience is JavaScript/TypeScript developers who use Bun or are considering
  switching from patch-package. Preserve every code block and every reference.
  Tone: confident but humble; "here's how it works and where it breaks."
  Target ~2200 words.

tags:
  - bun
  - npm
  - tooling
  - dependencies
  - ci-cd
---

# The Escape Hatch

A package is doing 99% of what you need. The remaining 1% is wrong, but it's wrong in a way that's *hardcoded inside the package itself* — no config, no env var, no plugin hook. The fix is one line in someone else's source code.

You have four options:

1. **Find a different package** — sometimes there isn't one.
2. **Open an upstream PR** — sometimes the maintainer is asleep, dead, or unconvinced.
3. **Fork the package** — heavy, you now maintain it forever.
4. **Patch it** — change the file in `node_modules` and have your package manager re-apply the change on every install.

Option 4 is what this post is about.

[`patch-package`](https://github.com/ds300/patch-package) made this pattern famous for npm/Yarn. [Bun](https://bun.sh) ships the same functionality natively with `bun patch`. The workflow is faster and the integration is tighter — no extra postinstall hook, the patches are first-class entries in `package.json`.

I just used it on a real production app to fix something that was bleeding 86,000 Convex function calls per month out of my free-tier budget. The fix took five minutes. Here's the whole workflow with a worked example, plus the things the docs don't tell you.

## The challenge

I was using [`@convex-dev/persistent-text-streaming`](https://www.convex.dev/components/persistent-text-streaming) to stream AI responses (Claude / GPT) into our editor's UI token-by-token. The component is great. It does exactly what it advertises.

It also ships an internal cron:

```js
// node_modules/@convex-dev/persistent-text-streaming/dist/component/crons.js
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
const crons = cronJobs();
// Run every minute
crons.interval(
  "cleanup expired streams",
  { minutes: 1 },
  internal.lib.cleanupExpiredStreams,
);
export default crons;
```

This cron scans the `streams` table every 60 seconds, looks for stuck `pending`/`streaming` rows older than 20 minutes, and marks them `timeout`. It's harmless housekeeping. It just runs **way more often than I need it to**.

Math:

> 60 calls/hour × 24 × 30 = **~43,000 calls/month per Convex deployment**.
>
> Two deployments (Dev + Prod) = **~86,000 calls/month** for a maintenance job nobody ever sees.

My entire free-tier function-call budget is ~1M calls/month. This single internal cron — from a package I didn't write — was eating ~9% of it by itself, in *both* environments, doing nothing user-facing.

There is no configuration option. The interval is hardcoded. The expiration constant is hardcoded.

I needed to change `{ minutes: 1 }` to `{ hours: 24 }`. One line in a file I don't own.

## What `bun patch` actually does

Three steps, conceptually:

1. **Stage:** `bun patch <pkg>` makes the relevant `node_modules/<pkg>` folder writable and tells Bun "I'm about to modify this".
2. **Edit:** You change files in `node_modules/<pkg>` like a normal text edit.
3. **Commit:** `bun patch --commit <pkg>` diffs your changes against the original, saves the diff to `patches/<package>@<version>.patch`, and writes a `patchedDependencies` entry into `package.json`.

After that, every future `bun install` (including `--frozen-lockfile` in CI) extracts the package, applies your patch on top, and produces a `node_modules` that has your version. No postinstall hooks, no extra config — `patchedDependencies` is a first-class field in `package.json`.

## The five-minute workflow

```bash
# 1. Stage the package for editing.
bun patch "@convex-dev/persistent-text-streaming"
```

Output:

```
To patch @convex-dev/persistent-text-streaming, edit the following folder:

  node_modules/@convex-dev/persistent-text-streaming

Once you're done with your changes, run:

  bun patch --commit 'node_modules/@convex-dev/persistent-text-streaming'
```

```bash
# 2. Edit the file. The change: { minutes: 1 } → { hours: 24 }
$EDITOR node_modules/@convex-dev/persistent-text-streaming/dist/component/crons.js
```

After my edit, that file reads:

```js
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api.js";
const crons = cronJobs();
// Run every 24 hours (patched from 1 minute to reduce Convex function-call budget)
crons.interval(
  "cleanup expired streams",
  { hours: 24 },
  internal.lib.cleanupExpiredStreams,
);
export default crons;
```

```bash
# 3. Commit the patch.
bun patch --commit 'node_modules/@convex-dev/persistent-text-streaming'
```

Bun does three things on commit:

1. Saves the diff to `patches/@convex-dev%2Fpersistent-text-streaming@0.3.2.patch`. (The `%2F` is URL-encoded `/` — patch filenames must be filesystem-safe.)
2. Adds an entry to `package.json`:
   ```json
   "patchedDependencies": {
     "@convex-dev/persistent-text-streaming@0.3.2":
       "patches/@convex-dev%2Fpersistent-text-streaming@0.3.2.patch"
   }
   ```
3. Updates `bun.lock` so the patched version is pinned.

That's it. Commit those three files to git, push, done.

## What the patch file looks like

```diff
diff --git a/dist/component/crons.js b/dist/component/crons.js
index 08b59badd6f1df060ab8a96189d0c8f1fd464c90..105819b8df801a8724dc13a944356731691c97ab 100644
--- a/dist/component/crons.js
+++ b/dist/component/crons.js
@@ -1,7 +1,7 @@
 import { cronJobs } from "convex/server";
 import { internal } from "./_generated/api.js";
 const crons = cronJobs();
-// Run every minute
-crons.interval("cleanup expired streams", { minutes: 1 }, internal.lib.cleanupExpiredStreams);
+// Run every 24 hours (patched from 1 minute to reduce Convex function-call budget)
+crons.interval("cleanup expired streams", { hours: 24 }, internal.lib.cleanupExpiredStreams);
 export default crons;
 //# sourceMappingURL=crons.js.map
```

Three useful things to notice:

1. **It's a standard unified diff.** You can read it, review it in a PR, and reason about exactly what changed.
2. **It pins the version.** The patch file references `0.3.2`. If the upstream package bumps to `0.3.3` and the file structure changes, Bun will warn you the patch no longer applies cleanly. You'll re-create the patch against the new version.
3. **Sometimes Bun adds a `.bun-tag-...` marker.** If you see one in the diff, delete those lines — they're internal bookkeeping that occasionally leaks into the saved patch. Clean diffs only.

## CI: it just works

The clutch part of this workflow is what happens in CI.

```yaml
# .github/workflows/convex-deploy.yml (excerpt)
- name: Install dependencies
  run: bun install --frozen-lockfile

- name: Deploy
  run: bunx convex deploy
```

When that `bun install --frozen-lockfile` runs:

1. Bun reads `package.json`, sees `patchedDependencies`.
2. Bun resolves the dependency tree from `bun.lock`.
3. Bun extracts the package as published.
4. Bun applies the patch file from `patches/`.
5. Result: `node_modules/<pkg>` contains your modified version.

No extra step in the workflow. No `patch-package` postinstall. No "did the patches apply?" debugging.

**One gotcha I hit**: my `convex-deploy.yml` had a `paths:` filter that only triggered the workflow on `convex/**` changes. The patch commit only touched `package.json`, `bun.lock`, and `patches/` — none of which were watched. So the patch landed in `main` but the deploy never fired.

Fix:

```yaml
on:
  push:
    branches: [main]
    paths:
      - "convex/**"
      - "package.json"
      - "bun.lock"
      - "patches/**"
```

If you use any kind of paths filter on your deploy workflow, **add the dependency files**. Otherwise patching a package becomes "I patched it but nothing in production changed and I have no idea why."

## When you should NOT patch

Patching is the cheap, fast option. It's also the option that's quietly fragile to upstream changes. Use it when:

- The change is small (a few lines).
- The package isn't going to refactor that file imminently.
- You're confident the upstream maintainer wouldn't accept your specific need (e.g. it's project-specific, not generally useful).
- You've already tried opening an issue or a PR and gotten no traction.

**Open an upstream PR instead when:**

- The change is broadly useful (e.g. making a hardcoded constant configurable). Other people are hitting the same wall. The PR will help them and let you delete your patch.
- The package is well-maintained and PRs are merged quickly.
- The fix is in an area that changes often — a patch you carry will rot.

**Fork instead when:**

- The changes are extensive (10+ files, restructuring).
- You want a different release cadence.
- The package is abandoned but you want a clear governance story (so you can publish a new name, accept PRs from others, etc.).

**Vendor (copy into your repo) instead when:**

- The package is small and you want zero external dependency.
- You want to delete bits you don't use.
- The licensing allows it.

For my case — change a hardcoded constant in a maintained package — patching was correct. The right *long-term* fix is for me to open a PR exposing the interval as a config option, and delete my patch when it merges. I'll do that. The patch is the bridge.

## The actual savings

Before the patch:

- 60 calls/hour × 24 × 30 = **~43K/month per deployment**
- Dev + Prod = **~86K/month**

After (`{ hours: 24 }`):

- 1 call/day × 30 = **~30/month per deployment**
- Dev + Prod = **~60/month**

That's a **99.93% reduction** for this single function. My free-tier function-call budget went from 91% used to comfortably below 50%. The AI streaming features the package powers still work exactly the same — only the housekeeping cadence changed.

## Reflection: dependency archaeology

The real lesson from this isn't about `bun patch`. The patch was just the fix.

The lesson is that **components and packages aren't just code; they're operational footprints**. When you `app.use(persistentTextStreaming)` in a Convex config, you're not just importing functions — you're inheriting a cron, a table, and a behavior pattern the maintainer chose. You pay for those choices whether you use them or not.

Same idea applies anywhere:

- Sentry SDK runs a background flush loop.
- LaunchDarkly polls for flag updates.
- Most ORM "migration" libraries probe for schema state on boot.

If you're on a metered backend (function calls, database operations, queries), every dependency has a usage cost you didn't write. Read the source. Look for `cron`, `interval`, `setTimeout`, `setInterval` in the package's published files. Understand what's running in the background.

If something's running too hot, `bun patch` is the five-minute fix while you figure out the real one.

## Cheat sheet

```bash
# Start patching a package
bun patch "<package-name>"

# (edit files in node_modules/<package-name>)

# Save the patch
bun patch --commit "node_modules/<package-name>"

# Verify it survives a clean install
rm -rf node_modules
bun install --frozen-lockfile

# Commit to git
git add package.json bun.lock patches/
git commit -m "patch <package>: <one-line reason>"
```

To update a patch later, re-run `bun patch <package-name>`, edit, and `bun patch --commit` again. Bun overwrites the existing patch file.

To delete a patch, remove the `patchedDependencies` entry from `package.json`, delete the `.patch` file, and run `bun install`.

## References

- [Bun patches documentation](https://bun.sh/docs/install/patch)
- [`patchedDependencies` field in package.json](https://bun.sh/docs/install/patch#patcheddependencies)
- [npm patch-package (the OG, still excellent for non-Bun projects)](https://github.com/ds300/patch-package)
- [Convex persistent text streaming component](https://www.convex.dev/components/persistent-text-streaming)
- [Convex pricing & limits](https://www.convex.dev/pricing)
- [GitHub Actions `paths` filter docs](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#onpushpull_requestpaths)
