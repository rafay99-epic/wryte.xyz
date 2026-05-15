---
title: "Your Folder Structure Is Your Architecture (And Mine Was a Lie)"
slug: folder-structure-as-architecture
description: "I had a 3,352-line settings page and 33 inline components in a single file. The refactor that fixed it was mostly `git mv` — but the mental shift behind those moves is the only architectural decision that actually scales."
date: 2026-05-15
author: "Abdul Rafay"
canonicalUrl: "https://wryte.xyz/blog/folder-structure-as-architecture"
ogImage: "/images/blog/folder-structure-cover.png"
twitterCard: "summary_large_image"

# SEO
keywords:
  - feature-sliced design
  - next.js folder structure
  - scalable codebase
  - react project organization
  - co-locate by feature
  - components vs features folder
  - frontend architecture
  - refactor monolithic page
  - shared primitives vs feature components
  - import graph blast radius
seo:
  title: "Your Folder Structure Is Your Architecture"
  description: "How feature folders replaced a 3,352-line settings page with something I could actually navigate — and the rule I use now for every new file."
  openGraph:
    type: article
    title: "Your Folder Structure Is Your Architecture"
    description: "Mostly `git mv`. A different mental model. Code I can actually find."
    image: "/images/blog/folder-structure-cover.png"
  twitter:
    card: summary_large_image
    title: "Your Folder Structure Is Your Architecture"
    description: "The 30,000-line refactor that was mostly file moves."

imagePrompt: >
  Cinematic overhead shot of a workshop bench. On the left, a chaotic pile
  of identical small drawers all stamped "components" — overflowing with
  mismatched parts. On the right, a clean wooden cabinet with each drawer
  hand-labelled "editor", "dashboard", "settings", "calendar". Warm
  directional light from upper right, muted earth tones, single accent of
  amber light glinting off the cabinet labels. Subtle wood grain, fine
  shadow detail. 16:9 ratio. No other text in frame.

regenerationPrompt: >
  Rewrite as a first-person engineering narrative for working frontend
  developers. Keep the arc: hit-the-wall → wrong mental model → switch to
  feature folders → what changes day-to-day. Concrete numbers from a real
  Next.js codebase. Voice: honest, slightly self-deprecating, no
  framework evangelism. Don't sell "feature-sliced design" as a brand —
  sell the *thinking* behind it. Audience: mid-to-senior IC engineers
  who've shipped enough to recognise the smell but haven't yet read the
  vocabulary. Target ~1800 words.

tags:
  - architecture
  - refactoring
  - frontend
  - nextjs
  - engineering-practice
---

# 3,352 lines

The settings page for a project in my CMS was **3,352 lines**. One file. Thirty-three inline components, including six provider-logo SVGs, four skeleton components, three near-identical credential forms (one per AI provider), and a danger-zone confirm dialog that existed in two other files almost identically. Seventy-something `useState` calls.

I knew it was bad. The fix kept getting deferred. "Next sprint." "After the launch." "After the *other* launch."

What finally made me sit down and refactor wasn't the size. It was that I'd opened that file three days in a row to find one thing — a status badge, a save handler, a form field — and I couldn't remember where any of them lived. Cmd-F was my navigation. I had paged through this file enough times to know its shape by feel, like driving a route you can't actually describe.

That's the smell. Not "this file is too long." That, I could rationalise — it's just a settings page, it's mostly forms, of course it's long. The actual smell was **I can't find anything inside it without searching, and I wrote it.**

## What I had

The project looked, on paper, like every Next.js codebase ever:

```
src/
├── app/                        # routes
├── components/
│   ├── ui/                     # shadcn primitives
│   ├── layout/                 # header, sidebar
│   ├── providers/              # context wrappers
│   ├── editor/                 # editor stuff
│   ├── projects/               # ...project stuff
│   ├── media/                  # media stuff
│   ├── documents/              # a single status badge
│   └── settings/               # a single compression form
├── hooks/                      # 8 cross-cutting hooks
├── stores/                     # Zustand
└── lib/                        # utils
```

The organising principle was **file type**. Components live with components. Hooks live with hooks. UI primitives live in `ui/`. Routes live in `app/`. It's the structure the framework templates ship with. It's the structure every tutorial uses. It's wrong.

Here's what was *actually* happening: every feature was scattered across four folders. The editor's logic was inside `app/editor/[id]/page.tsx`. Its sub-components were in `components/editor/`. Its hooks were either inline-defined inside the page or sitting alone in `hooks/`. Its types were duplicated — once in `types/`, once inline at the top of a component file. To touch the editor I'd open six tabs.

The settings page was the worst example, but it was a symptom, not the disease. The disease was that **nothing was a feature**. Everything was a *kind of file*. And when you organise by kind, every change becomes a cross-folder change, because no change is "just" a component or "just" a hook.

## The mental shift

The frame that broke me out of it was a question:

> If I deleted the entire `editor/` feature tomorrow, how many files and folders would I touch?

In my old structure, the answer was: one route file in `app/`, several files in `components/editor/`, two files in `hooks/`, a type file in `types/`, and probably a few stragglers in `lib/`. Six locations. Tied together by nothing but my memory of having written them.

In the structure I moved to, the answer is: I delete `src/features/editor/`. That's it. The folder *is* the feature. The blast radius of "remove this feature" is the same as the blast radius of "find this feature": one path.

This is the only architectural property that scales. Not lines per file. Not function length. Not abstraction depth. **Locality.** Code that changes together should live together. Code that doesn't should live elsewhere. Everything else is decoration.

## What I moved to

```
src/
├── app/                        # ROUTES — thin shells only
│   ├── (app)/dashboard/page.tsx           → <DashboardPage />
│   ├── (app)/projects/[id]/page.tsx       → <ProjectDetailPage />
│   ├── (app)/editor/[id]/page.tsx         → <EditorPage />
│   └── (app)/settings/page.tsx            → <AccountSettingsPage />
│
├── features/                   # ONE FOLDER PER FEATURE
│   ├── dashboard/
│   │   ├── dashboard-page.tsx
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types.ts
│   ├── editor/
│   │   ├── editor-page.tsx
│   │   ├── components/
│   │   │   ├── frontmatter-editor.tsx
│   │   │   ├── frontmatter-ai-drawer.tsx
│   │   │   ├── publish-dialog.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   └── context/
│   ├── project-settings/
│   │   ├── project-settings-page.tsx       # was 3,352 lines
│   │   ├── tabs/                           # general, github, ai, …
│   │   ├── components/
│   │   └── hooks/
│   ├── media-library/
│   ├── calendar/
│   └── marketing/                          # server components
│
├── components/                 # SHARED CHROME + PRIMITIVES only
│   ├── ui/                     # design system primitives
│   ├── forms/                  # SettingField, TagChipsInput, MediaPickerInput
│   ├── feedback/               # skeletons, empty states, error banners
│   ├── dialogs/                # ConfirmDestructiveAction, FormDialog
│   ├── layout/                 # header, sidebar, theme toggle
│   ├── providers/              # context wrappers
│   └── branding/               # logos, brand icon
│
├── hooks/                      # ONLY cross-cutting hooks
│   ├── use-app-hotkeys.ts
│   ├── use-image-compression.ts
│   └── use-github.ts
│
├── stores/                     # Zustand stores
├── lib/                        # pure utilities
└── types/                      # shared types only
```

Three rules govern where a file goes:

1. **Used by one feature → lives in that feature.** No exceptions. A hook that's only called by the editor lives in `features/editor/hooks/`. Moving it to `src/hooks/` because "we might reuse it" is how you end up with 200 hooks in a folder and no idea which ones are still wired up.

2. **Used by multiple features → lives in `src/components/forms`, `src/components/feedback`, `src/components/dialogs`, etc.** Categorised by what kind of primitive it is. These are *intentionally* generic — they take props, they don't know about your domain. A `<TagChipsInput>` doesn't care whether it's editing post tags or document keywords; it takes a comma-separated string and gives you chips.

3. **App routing → stays in `src/app/`, but route files are 5-line shells** that mount the feature's page component. The route file is for Next.js plumbing (`metadata`, `dynamic`, `revalidate`); the actual page lives in `features/<name>/<name>-page.tsx`.

## The move was mostly `git mv`

Here's the part the architecture diagrams never show you: **most of the refactor was `git mv`.** I didn't rewrite the editor. I picked up the editor's files from `components/editor/` and put them down in `features/editor/components/`. The components didn't change. The behaviour didn't change. Tests, where I had them, still passed. Type-check stayed green between every batch of moves.

The actually-rewriting work was bounded and visible up front:

- The two monster page files needed splitting. 3,352 lines became one orchestrator + eight tab files. 1,373 lines became one orchestrator + five tab files.
- A few god-components in the editor got broken up (`frontmatter-editor.tsx` was 1,113 lines of switch-on-type rendering — split into a field-list component, a field-control component, and the orchestrator).
- Duplicate inline definitions of the same type got consolidated into `src/types/`.

Everything else was *physical* reorganisation. Move the file. Update the imports. Re-run lint. Commit.

This is the part I want you to remember if you take nothing else away: **the hard part of "improve our architecture" is not invention. It's deciding the rule and then doing the work.** The rule is one paragraph. The work is two days of `git mv` and import fixups. Anyone telling you they need to "rewrite the frontend" to fix structural problems is either bored or selling you something.

## What changed day-to-day

A few weeks in, the things I notice:

- **I never `Cmd-F` inside a file anymore.** I `Cmd-P` to the feature folder and the file name is obvious from the feature's contents.
- **New features go in one folder.** I added a calendar feature; everything for it lives in `features/calendar/`. When the inevitable "let's remove the calendar for V2" comes, the diff is one folder.
- **Reuse is decided once, not negotiated each time.** Either the thing is a primitive (lives in `components/forms` and takes props) or it's not (lives in the feature). Not "maybe we'll lift this out someday."
- **Imports point one direction.** Features import from `components/*` and `lib/*`. Features don't import from each other. If two features need to talk, the shared piece graduates into `components/*` or a shared hook. This is the one architectural constraint I enforce strictly — a feature reaching into another feature is the only thing I'll comment on in review.

## What I'd warn you about

Three things I got wrong on the way that you should sidestep:

**Don't pre-split.** I almost made `features/editor/frontmatter/` a sub-feature. It would have been correct, taxonomically. It would also have meant five sub-folders for what is, in practice, one editor. Feature folders aren't the bottom of a fractal — they're a flat list of meaningful nouns in your product.

**Don't over-extract primitives.** Just because two features use a similar-looking card layout doesn't mean you need `<FeatureCard>` in `components/`. The cost of duplication is small. The cost of a wrongly-shaped abstraction is enormous. Wait until the third use; sometimes wait until the fourth.

**Don't move things you're about to delete.** I wasted half a day moving components into feature folders, then deleted three of them an hour later when I realised they were no longer wired up to anything. Audit the import graph before you move. If a component has zero importers, the right move is `git rm`, not `git mv`.

## The rule

If you're staring at a project that's growing and feels harder to navigate every week, ask yourself the question that broke me out of my old structure:

> If I deleted feature X tomorrow, how many separate folders would I touch?

If the answer is more than one, you're not organised by feature. You're organised by file type, and your codebase is fighting you. The fix is mostly `git mv`. The mental shift is one paragraph. You can start tonight.
