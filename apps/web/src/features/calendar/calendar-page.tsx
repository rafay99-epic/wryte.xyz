"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { fadeSlideUp, smoothTransition } from "@wryte/logic/lib/motion";
import { useEditorStore } from "@wryte/logic/stores/editor-store";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { CalendarDays } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { CalendarSurface } from "@/features/calendar/components/calendar-surface";

export function CalendarPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId as Id<"projects">;

  const project = useQuery(api.cms.projects.get, { projectId });

  // Set active project in sidebar
  useEffect(() => {
    useEditorStore.getState().setActiveProjectId(projectId);
  }, [projectId]);

  // Not found (loading is handled by the surface's skeleton)
  if (project === null) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <motion.div
          variants={fadeSlideUp}
          initial="initial"
          animate="animate"
          transition={smoothTransition}
          className="text-center"
        >
          <CalendarDays className="mx-auto mb-3 size-10 text-muted-foreground/30" />
          <h2 className="mb-1 text-lg font-bold text-foreground">
            Project not found
          </h2>
          <p className="text-sm text-muted-foreground">
            This project doesn&apos;t exist or may have been deleted.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <CalendarSurface projectId={projectId} />
    </div>
  );
}
