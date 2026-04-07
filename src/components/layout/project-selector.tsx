"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useEditorStore } from "@/stores/editor-store";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, FolderOpen, Plus, PenLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

export function ProjectSelector() {
  const router = useRouter();
  const projects = useQuery(api.projects.list);
  const activeProjectId = useEditorStore((s) => s.activeProjectId);
  const setActiveProjectId = useEditorStore((s) => s.setActiveProjectId);

  const activeProject = projects?.find((p) => p._id === activeProjectId);

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
          {projects?.map((project) => (
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
                <span className="truncate">{project.name}</span>
              </DropdownMenuItem>
            </motion.div>
          ))}

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
