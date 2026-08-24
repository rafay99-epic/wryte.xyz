"use client";

import { UserButton } from "@clerk/nextjs";
import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { getColorClasses } from "@wryte/logic/lib/board-colors";
import { APP_RELEASE_LABEL } from "@wryte/logic/lib/release";
import { cn } from "@wryte/logic/lib/utils";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { DEFAULT_BOARD_COLUMNS } from "@wryte/logic/types/board";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Clapperboard,
  Database,
  FileText,
  FolderOpen,
  ImageIcon,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Plus,
  Settings,
  Star,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { SidebarDocumentLink } from "@/components/layout/app-sidebar/sidebar-document-link";
import { SidebarNavLink as NavLink } from "@/components/layout/app-sidebar/sidebar-nav-link";
import { useIsAdmin } from "@/components/layout/hooks/use-is-admin";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/* ------------------------------------------------------------------ */
/*  AppSidebar                                                         */
/* ------------------------------------------------------------------ */

export function AppSidebar() {
  const router = useRouter();
  const activeProjectId = useEditorStore((s) => s.activeProjectId);
  const setActiveProjectId = useEditorStore((s) => s.setActiveProjectId);

  const isAdmin = useIsAdmin();
  const projects = useQuery(api.cms.projects.list);
  const documents = useQuery(
    api.cms.documents.list,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );
  // Animations nav item: MDX projects with the feature toggled on. Derived
  // from the already-fetched projects list — no extra query. Absent toggle
  // falls back to path presence (projects configured before it existed).
  const activeProject = projects?.find((p) => p._id === activeProjectId);
  const animationsNavEnabled =
    activeProject?.contentFormat === "mdx" &&
    (activeProject.animationsEnabled ?? !!activeProject.animationsPath);

  function handleBack() {
    const pathname = window.location.pathname;

    // Hierarchical "up", one level at a time — the user's mental model is
    // editor → project → dashboard, and equally sub-page (media/animations/
    // calendar/…) → project → dashboard. Deterministic on purpose: browser
    // history can point anywhere after cross-page hops, which made this
    // button feel random.
    if (pathname.startsWith("/editor/") && activeProjectId) {
      router.push(`/projects/${activeProjectId}`);
      return;
    }
    const subPage = /^\/projects\/([^/]+)\/.+/.exec(pathname);
    if (subPage?.[1]) {
      router.push(`/projects/${subPage[1]}`);
      return;
    }
    setActiveProjectId(null);
    router.push("/dashboard");
  }

  // Compute status counts for sidebar filter chips
  const { sidebarFavorites, sidebarOthers } = useMemo(() => {
    if (!projects) {
      return {
        sidebarFavorites: [] as {
          _id: string;
          name: string;
          isFavorite?: boolean;
        }[],
        sidebarOthers: [] as {
          _id: string;
          name: string;
          isFavorite?: boolean;
        }[],
      };
    }
    const sidebarFavorites = projects.filter((p) => p.isFavorite);
    const sidebarOthers = projects.filter((p) => !p.isFavorite);
    return { sidebarFavorites, sidebarOthers };
  }, [projects]);

  const statusCounts = useMemo(() => {
    if (!documents) return null;
    const counts: Record<string, number> = {};
    for (const col of DEFAULT_BOARD_COLUMNS) {
      counts[col.id] = 0;
    }
    for (const doc of documents) {
      const status = doc.status ?? "draft";
      if (counts[status] !== undefined) {
        counts[status]++;
      } else {
        counts[status] = 1;
      }
    }
    return counts;
  }, [documents]);

  return (
    <div className="flex h-full w-[260px] flex-col bg-sidebar">
      {/* Product header */}
      <Link
        href="/"
        className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4"
      >
        <BrandIcon width={24} height={24} className="rounded-md" />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          wryte
        </span>
      </Link>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto slim-scrollbar px-3 py-3">
        <AnimatePresence mode="wait" initial={false}>
          {!activeProjectId ? (
            <motion.div
              key="default"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Home & Settings */}
              <div className="space-y-0.5">
                <NavLink
                  href="/dashboard"
                  icon={LayoutDashboard}
                  label="Home"
                />
                <NavLink href="/projects" icon={Layers} label="Projects" />
                <NavLink
                  href="/calendar"
                  icon={CalendarDays}
                  label="Calendar"
                />
                <NavLink href="/settings" icon={Settings} label="Settings" />
              </div>

              <div className="my-3 h-px bg-sidebar-border" />

              {/* Admin — only visible to users with publicMetadata.role === "admin".
                  Mutations re-verify the role server-side, so this is just UX. */}
              {isAdmin && (
                <>
                  <div className="mb-3">
                    <div className="mb-1.5 px-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        Admin
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <NavLink
                        href="/admin/feature-requests"
                        icon={Lightbulb}
                        label="Feature requests"
                      />
                      <NavLink
                        href="/admin/seed"
                        icon={Database}
                        label="Seed data"
                      />
                    </div>
                  </div>
                  <div className="my-3 h-px bg-sidebar-border" />
                </>
              )}

              {/* Projects */}
              <div>
                <div className="mb-1.5 flex items-center justify-between px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Projects
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push("/projects/new")}
                    className="flex size-5 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-all"
                    aria-label="Create new project"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {projects === undefined ? (
                  <div className="space-y-1.5 px-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded-lg bg-muted/40"
                      />
                    ))}
                  </div>
                ) : projects.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground/50">
                    No projects yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sidebarFavorites.length > 0 && (
                      <div className="space-y-0.5">
                        <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
                          Favorites
                        </p>
                        {sidebarFavorites.map((project, index) => (
                          <motion.div
                            key={project._id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03, duration: 0.2 }}
                          >
                            <Link
                              href={`/projects/${project._id}`}
                              onClick={() => setActiveProjectId(project._id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-left text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
                            >
                              <FolderOpen className="size-4 shrink-0 text-muted-foreground/60" />
                              <span className="min-w-0 flex-1 truncate">
                                {project.name}
                              </span>
                              <Star
                                className="size-3.5 shrink-0 text-amber-400"
                                fill="currentColor"
                                aria-hidden
                              />
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {sidebarOthers.length > 0 && (
                      <div className="space-y-0.5">
                        {sidebarFavorites.length > 0 && (
                          <p className="px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                            All workspaces
                          </p>
                        )}
                        {sidebarOthers.map((project, index) => (
                          <motion.div
                            key={project._id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              delay: (sidebarFavorites.length + index) * 0.03,
                              duration: 0.2,
                            }}
                          >
                            <Link
                              href={`/projects/${project._id}`}
                              onClick={() => setActiveProjectId(project._id)}
                              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-left text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
                            >
                              <FolderOpen className="size-4 shrink-0 text-muted-foreground/60" />
                              <span className="min-w-0 flex-1 truncate">
                                {project.name}
                              </span>
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="project"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Back */}
              <button
                type="button"
                onClick={handleBack}
                className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
                <span>Back</span>
              </button>

              {/* Project nav */}
              <div className="space-y-0.5">
                <NavLink
                  href={`/projects/${activeProjectId}`}
                  icon={LayoutDashboard}
                  label="Overview"
                  exact
                />
                <NavLink
                  href={`/projects/${activeProjectId}/articles`}
                  icon={FileText}
                  label="Articles"
                />
                <NavLink
                  href={`/projects/${activeProjectId}/media`}
                  icon={ImageIcon}
                  label="Media"
                />
                {animationsNavEnabled && (
                  <NavLink
                    href={`/projects/${activeProjectId}/animations`}
                    icon={Clapperboard}
                    label="Animations"
                  />
                )}
                <NavLink
                  href={`/projects/${activeProjectId}/calendar`}
                  icon={CalendarDays}
                  label="Calendar"
                />
                <NavLink
                  href={`/projects/${activeProjectId}/settings`}
                  icon={Settings}
                  label="Settings"
                />
              </div>

              <div className="my-3 h-px bg-sidebar-border" />

              {/* Articles list */}
              <div>
                <div className="mb-1.5 flex items-center justify-between px-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                    Articles
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/projects/${activeProjectId}/documents/new`)
                    }
                    className="flex size-5 items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-all"
                    aria-label="Create new article"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>

                {/* Status filter chips */}
                {statusCounts && documents && documents.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 px-3">
                    {DEFAULT_BOARD_COLUMNS.map((col) => {
                      const count = statusCounts[col.id] ?? 0;
                      if (count === 0) return null;
                      const colors = getColorClasses(col.color);
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() =>
                            router.push(
                              `/projects/${activeProjectId}?status=${col.id}`,
                            )
                          }
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
                        >
                          <span
                            className={cn("size-1.5 rounded-full", colors.dot)}
                          />
                          {count}
                        </button>
                      );
                    })}
                  </div>
                )}

                {documents === undefined ? (
                  <div className="space-y-1 px-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-7 animate-pulse rounded-md bg-muted/40"
                      />
                    ))}
                  </div>
                ) : documents.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground/50">
                    No articles yet
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {documents.map((doc, index) => (
                      <SidebarDocumentLink
                        key={doc._id}
                        documentId={doc._id}
                        index={index}
                        status={doc.status ?? "draft"}
                        title={doc.title || "Untitled"}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-2.5">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-6",
              },
            }}
          />
        </div>
        <p className="mt-2 text-center text-[9px] leading-tight text-muted-foreground/30">
          {APP_RELEASE_LABEL} ·{" "}
          <a
            href="https://syntaxlabtechnology.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground/50 transition-colors"
          >
            Syntax Lab Technology
          </a>
        </p>
      </div>
    </div>
  );
}
