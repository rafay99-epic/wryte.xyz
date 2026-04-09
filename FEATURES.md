# Wryte — Features

## Content Management

- **Rich Markdown Editor** — Full-featured MDX editor with live preview, frontmatter editing, and syntax highlighting
- **Draft Management & Status Workflow** — 5-stage pipeline: Draft → Review → Ready → Scheduled → Published with visual indicators throughout the app
- **Kanban Board View** — Drag-and-drop board for managing article status across configurable columns
- **Table View** — Sortable, filterable table view for content with inline actions
- **Document Tagging** — Add, edit, and filter articles by tags with autocomplete
- **Bookmarks** — Star/bookmark articles for quick access
- **Duplicate Documents** — One-click document duplication
- **Inline Rename** — Rename articles directly from the board card without opening the editor
- **Search** — Full-text search across article titles, slugs, and paths
- **Frontmatter Schema** — Per-project configurable frontmatter fields with type validation

## Publishing & Scheduling

- **One-Click Publish** — Publish articles to GitHub with a single click
- **Scheduled Publishing** — Set a future date/time for automatic publishing via durable workflows
- **GitHub Sync** — Two-way sync between Wryte and your GitHub repository
- **Auto-Import** — Import existing markdown files from GitHub into Wryte
- **Batch Import** — Select and import multiple remote files at once

## Project Management

- **Multi-Project Support** — Manage multiple content projects from a single workspace
- **Project Creation Wizard** — 3-step wizard: repo selection, path configuration, frontmatter schema
- **Board Column Customization** — Add, remove, reorder, and color-code kanban columns per project
- **Project Settings** — Configure GitHub repo, content paths, media paths, and frontmatter schema

## GitHub Integration

- **OAuth Authentication** — Connect GitHub via OAuth with private repo access
- **Repository Browser** — Search and select from your GitHub repositories
- **Branch Support** — Configure which branch to sync with
- **Remote File Management** — View, import, and delete files directly on GitHub
- **Manual Setup** — Option to configure GitHub details manually without OAuth

## Editor Experience

- **Focus Mode** — Distraction-free writing mode (Esc to exit)
- **Auto-Save** — Real-time auto-save with visual status indicators (Saving/Unsaved/Saved)
- **Article Navigation** — Navigate between articles with prev/next arrows
- **Inline Status Selector** — Change document status directly from the editor header
- **Breadcrumb Navigation** — Context-aware breadcrumbs showing project → article hierarchy

## Dashboard

- **Status Overview** — At-a-glance stats for all document statuses (Draft, Review, Ready, Scheduled, Published)
- **Recent Activity** — Quick access to recently edited articles
- **Project Quick Access** — Jump to any project from the dashboard
- **Keyboard Shortcuts** — Command palette and configurable shortcuts

## Navigation & UI

- **Collapsible Sidebar** — Animated sidebar with project/article navigation
- **Status Filter Chips** — Filter articles by status from the sidebar
- **Theme Toggle** — Light/dark mode support
- **Responsive Design** — Mobile-friendly layouts with adaptive navigation
- **Framer Motion Animations** — Smooth transitions throughout the app
- **Command Palette** — Quick search and action execution

## Authentication & Security

- **Clerk Authentication** — Secure sign-in with multiple providers
- **GitHub OAuth Scopes** — Granular permissions for repository access
- **Protected Routes** — Middleware-enforced authentication for all app routes
- **JWT Integration** — Secure Convex backend authentication via Clerk JWT templates

## Infrastructure

- **Convex Real-Time Database** — Live-updating queries with optimistic UI
- **Durable Workflows** — Reliable scheduled publishing with 3x retry
- **GitHub Actions CI/CD** — Automatic Convex deployment on changes
- **SEO & Metadata** — Full SEO setup with OpenGraph, Twitter cards, JSON-LD structured data
- **PWA Manifest** — Progressive web app support
- **Sitemap & Robots.txt** — Search engine optimization

## Legal & Marketing

- **Landing Page** — Dark cinematic theme with animated sections
- **Terms of Service** — Styled legal page matching the marketing theme
- **Privacy Policy** — Interactive privacy page with data type and third-party service cards
