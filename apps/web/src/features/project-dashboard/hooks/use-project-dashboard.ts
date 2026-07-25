"use client";

import { api } from "@wryte/backend/_generated/api";
import type { Id } from "@wryte/backend/_generated/dataModel";
import { useQuery } from "convex/react";

export function useProjectDashboard(projectId: Id<"projects">) {
  const stats = useQuery(api.analytics.writingStats.getProjectDashboardStats, {
    projectId,
  });
  const recentDocs = useQuery(api.cms.documents.listRecent, {
    projectId,
    limit: 8,
  });
  const upcoming = useQuery(api.analytics.writingStats.getUpcomingScheduled, {
    projectId,
    limit: 5,
  });

  const isLoading = stats === undefined;

  const totalDocs = stats?.totalDocs ?? 0;
  const statusCounts = {
    draft: stats?.statusCounts.draft ?? 0,
    review: stats?.statusCounts.review ?? 0,
    ready: stats?.statusCounts.ready ?? 0,
    scheduled: stats?.statusCounts.scheduled ?? 0,
    published: stats?.statusCounts.published ?? 0,
  };

  return {
    stats,
    recentDocs,
    upcoming,
    isLoading,
    totalDocs,
    statusCounts,
  };
}
