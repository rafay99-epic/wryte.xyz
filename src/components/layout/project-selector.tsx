"use client";

import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ChevronDown, FolderOpen, PenLine, Plus, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editor-store";
import { api } from "../../../convex/_generated/api";

export function ProjectSelector() {
  const router = useRouter();
  const projects = useQuery(api.cms.projects.list);
  const activeProjectId = useEditorStore((s) => s.activeProjectId);
  const setActiveProjectId = useEditorStore((s) => s.setActiveProjectId);

  const activeProject = projects?.find((p) => p._id === activeProjectId);

  const { favorites, others } = useMemo(() => {
    if (!projects) return { favorites: [], others: [] };
    return {
      favorites: projects.filter((p) => p.isFavorite),
      others: projects.filter((p) => !p.isFavorite),
    };
  }, [projects]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-14 w-full justify-between rounded-none border-b px-4"
          />
        }
      >
        <div className="flex items-center gap-2 truncate">
          {activeProject ? (
            <FolderOpen className="size-4 text-muted-foreground" />
          ) : (
            <PenLine className="size-4" />
          )}
          <span className="truncate font-semibold">
            {activeProject?.name ?? "Wryte"}
          </span>
          {activeProject?.isFavorite ? (
            <Star
              className="size-3.5 shrink-0 text-amber-400"
              fill="currentColor"
              aria-hidden
            />
          ) : null}
        </div>
        <ChevronDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-[--radix-dropdown-menu-trigger-width]"
      >
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {favorites.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/90">
                Favorites
              </DropdownMenuLabel>
              {favorites.map((project) => (
                <motion.div key={project._id} variants={staggerItem}>
                  <DropdownMenuItem
                    className={cn(
                      "cursor-pointer gap-2",
                      project._id === activeProjectId && "bg-accent",
                    )}
                    onSelect={() => {
                      setActiveProjectId(project._id);
                      router.push(`/projects/${project._id}`);
                    }}
                  >
                    <FolderOpen className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                    <Star
                      className="size-3.5 shrink-0 text-amber-400"
                      fill="currentColor"
                      aria-hidden
                    />
                  </DropdownMenuItem>
                </motion.div>
              ))}
            </>
          )}
          {others.length > 0 && (
            <>
              {favorites.length > 0 && (
                <DropdownMenuLabel className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  All workspaces
                </DropdownMenuLabel>
              )}
              {others.map((project) => (
                <motion.div key={project._id} variants={staggerItem}>
                  <DropdownMenuItem
                    className={cn(
                      "cursor-pointer gap-2",
                      project._id === activeProjectId && "bg-accent",
                    )}
                    onSelect={() => {
                      setActiveProjectId(project._id);
                      router.push(`/projects/${project._id}`);
                    }}
                  >
                    <FolderOpen className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">
                      {project.name}
                    </span>
                  </DropdownMenuItem>
                </motion.div>
              ))}
            </>
          )}

          <DropdownMenuSeparator />

          <motion.div variants={staggerItem}>
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={() => router.push("/projects/new")}
            >
              <Plus className="size-4" />
              <span>Create new project</span>
            </DropdownMenuItem>
          </motion.div>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
