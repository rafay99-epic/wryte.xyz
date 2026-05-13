"use client";

import { UserButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  FolderOpen,
  ImageIcon,
  Layers,
  LayoutDashboard,
  Plus,
  Settings,
  Star,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getColorClasses } from "@/lib/board-colors";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { DEFAULT_BOARD_COLUMNS } from "@/types/board";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/* ------------------------------------------------------------------ */
/*  NavLink                                                            */
/* ------------------------------------------------------------------ */

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  exact,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    active ??
    (exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150",
        isActive
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
      {isActive && (
        <motion.div
          layoutId="sidebarActiveIndicator"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Status dot                                                         */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: string }) {
  const col = DEFAULT_BOARD_COLUMNS.find((c) => c.id === status);
  const dotColor = col
    ? getColorClasses(col.color).dot
    : "bg-muted-foreground/30";
  return (
    <span
      className={cn(
        "size-1.5 rounded-full shrink-0 transition-colors",
        dotColor,
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  AppSidebar                                                         */
/* ------------------------------------------------------------------ */

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeProjectId = useEditorStore((s) => s.activeProjectId);
  const setActiveProjectId = useEditorStore((s) => s.setActiveProjectId);

  const projects = useQuery(api.projects.list);
  const documents = useQuery(
    api.documents.list,
    activeProjectId ? { projectId: activeProjectId as Id<"projects"> } : "skip",
  );

  function handleBack() {
    setActiveProjectId(null);
    router.push("/dashboard");
  }

  function handleSelectProject(projectId: string) {
    setActiveProjectId(projectId);
    router.push(`/projects/${projectId}`);
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
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <BrandIcon width={24} height={24} className="rounded-md" />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          wryte
        </span>
      </div>

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
                <NavLink href="/settings" icon={Settings} label="Settings" />
              </div>

              <div className="my-3 h-px bg-sidebar-border" />

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
                          <motion.button
                            key={project._id}
                            type="button"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03, duration: 0.2 }}
                            onClick={() => handleSelectProject(project._id)}
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
                          </motion.button>
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
                          <motion.button
                            key={project._id}
                            type="button"
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              delay: (sidebarFavorites.length + index) * 0.03,
                              duration: 0.2,
                            }}
                            onClick={() => handleSelectProject(project._id)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-left text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground"
                          >
                            <FolderOpen className="size-4 shrink-0 text-muted-foreground/60" />
                            <span className="min-w-0 flex-1 truncate">
                              {project.name}
                            </span>
                          </motion.button>
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
                  icon={FileText}
                  label="Articles"
                  exact
                />
                <NavLink
                  href={`/projects/${activeProjectId}/media`}
                  icon={ImageIcon}
                  label="Media"
                />
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
                    {documents.map((doc, index) => {
                      const isActive = pathname.includes(doc._id);

                      return (
                        <motion.div
                          key={doc._id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03, duration: 0.2 }}
                          onClick={() => router.push(`/editor/${doc._id}`)}
                          className={cn(
                            "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-all",
                            isActive
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                          )}
                        >
                          <StatusDot status={doc.status ?? "draft"} />
                          <span className="truncate">
                            {doc.title || "Untitled"}
                          </span>
                        </motion.div>
                      );
                    })}
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
      </div>
    </div>
  );
}
