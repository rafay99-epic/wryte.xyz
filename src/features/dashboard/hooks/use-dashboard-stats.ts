"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export function useDashboardStats() {
  const dashStats = useQuery(api.analytics.writingStats.getDashboardStats);
  const upcoming = useQuery(api.analytics.writingStats.getUpcomingScheduled, {
    limit: 5,
  });
  const recentDocs = useQuery(api.cms.documents.listRecent, { limit: 8 });
  const projects = useQuery(api.cms.projects.list);

  const isLoading = dashStats === undefined;

  const total = dashStats?.totalDocs ?? 0;
  const statusCounts = {
    draft: dashStats?.statusCounts.draft ?? 0,
    review: dashStats?.statusCounts.review ?? 0,
    ready: dashStats?.statusCounts.ready ?? 0,
    scheduled: dashStats?.statusCounts.scheduled ?? 0,
    published: dashStats?.statusCounts.published ?? 0,
  };

  return {
    dashStats,
    upcoming,
    recentDocs,
    projects,
    isLoading,
    total,
    statusCounts,
  };
}
