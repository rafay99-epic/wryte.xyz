# End-to-end tests (Playwright)

Browser-level smoke tests for wryte.xyz, driven by
[Playwright](https://playwright.dev) against a **running** app + Convex backend.
Authentication uses the real Clerk sign-in via
[`@clerk/testing`](https://clerk.com/docs/testing/playwright/overview).

## Layout

```
e2e/
  setup/
    ensure-test-user.ts   # idempotently verify/provision the Clerk test account
    global.setup.ts       # sign in once, persist storage state to .auth/user.json
  support/
    editor.ts             # shared helpers (open a seeded article, edit textarea)
  smoke/
    marketing.unauth.spec.ts   # public marketing + protected-route redirect
    dashboard.authed.spec.ts   # dashboard greeting/stats + projects list
    editor.authed.spec.ts      # edit → autosave → outline → history
    drafts.authed.spec.ts      # create → edit → delete a draft (self-cleaning)
  .auth/user.json         # generated signed-in storage state (git-ignored)
```

## Prerequisites

1. **The app + local Convex backend must already be running.** The repo's
   `bun run dev` starts Next.js on `http://localhost:3000` and a local Convex
   backend. The e2e tests do **not** start a server (there is intentionally no
   `webServer` block in `playwright.config.ts`) — they attach to whatever
   `PLAYWRIGHT_BASE_URL` points at (default `http://localhost:3000`).
2. **`.env.local` present at the repo root** with the Clerk dev keys
   (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`) and
   `NEXT_PUBLIC_CONVEX_URL`. The Playwright config loads it automatically.
3. **Chromium installed** for Playwright:

   ```bash
   bun x playwright install chromium
   ```

## Running

```bash
# Against the default dev server (http://localhost:3000)
bun run test:e2e

# Against a specific instance (e.g. a dedicated test server on :3001)
PLAYWRIGHT_BASE_URL=http://localhost:3001 bun run test:e2e

# Interactive UI mode / last HTML report
bun run test:e2e:ui
bun run test:e2e:report
```

## How authentication works

Sign-in happens once, in the `setup` project, and is reused by every
authenticated spec via a saved storage state:

1. **`ensure-test-user.ts`** talks to the Clerk **Backend API** with
   `CLERK_SECRET_KEY` and verifies the test account exists (it is not mutated).
   It refuses to run against anything other than a development instance
   (`sk_test_...`).
2. **`clerkSetup()`** fetches a Clerk *testing token* so the dev instance does
   not treat the automated browser as a bot.
3. **`clerk.signIn({ page, emailAddress })`** performs a real, ticket-based
   sign-in: `@clerk/testing` mints a one-time sign-in token via the Backend API
   and completes it in the browser. This path needs **no password** and works
   even though this dev instance disables the password first-factor
   (it is GitHub-OAuth / email-code only).
4. The signed-in browser state is written to **`e2e/.auth/user.json`**. The
   `authenticated` Playwright project loads it via `storageState`; the
   `unauthenticated` project runs with a clean, anonymous context.

### Which account, and why

The authenticated smoke specs assert against **pre-existing seeded data** in the
local Convex backend: the **"Rafay99.Com"** project and its ~21 "Seeded article
NN" documents. That data is owned by a specific Clerk user, so the e2e account
must be that owner — a brand-new user would see an empty workspace.

- **Account:** controlled by `E2E_CLERK_USER_EMAIL`
  (default: the seeded project's owner on the dev instance).
- **Password:** `E2E_CLERK_USER_PASSWORD` — only used when *creating* a fresh
  account on an empty instance (default `Wryte-E2E-Test!2026`, a dev-only
  throwaway). The normal flow never needs it because sign-in is ticket-based.

To point the suite at a different Clerk dev instance / seeded account, override
those two env vars.

## What the smoke suite covers

| Spec | Auth | Asserts |
| --- | --- | --- |
| `marketing.unauth` | none | Home hero + nav render; `/dashboard` redirects anonymous users to the Clerk sign-in flow |
| `dashboard.authed` | signed in | Time-based greeting + stat pills on `/dashboard`; seeded "Rafay99.Com" project shown on `/projects` |
| `editor.authed` | signed in | Open project → open a seeded article → append a heading → autosave reaches the **Saved** state → toggle the **Outline** panel and click-jump to the heading → open **History** and see the **Snapshots** tab |
| `drafts.authed` | signed in | Create a blank draft from the tab bar → new tab appears → type into it → switch to **Main** → delete the draft (leaves state clean, so the spec is re-runnable) |

Authenticated specs only ever **append** to seeded article content — they never
overwrite it — and the drafts spec deletes whatever it creates.

## Notes on selectors

Specs prefer role/label/text selectors. A small number of stable hooks were
added to app components where nothing reliable existed:

- `data-testid="content-item-<slug>"` on content rows/board cards.
- `data-testid="save-status"` + `data-save-state` on the editor save pill.
- `aria-label` on icon-only toggles (Outline/Readability/Research, Publish
  history) and the draft menu triggers ("New draft", "Draft options: <label>").
