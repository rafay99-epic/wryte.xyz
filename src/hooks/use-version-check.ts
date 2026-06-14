"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_BUILD_SHA } from "@/lib/release";
import { api } from "../../convex/_generated/api";

const TOAST_ID = "version-update";
const STORAGE_KEY = "wryte:dismissed-build";

function getDismissedBuild(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setDismissedBuild(build: string) {
  try {
    localStorage.setItem(STORAGE_KEY, build);
  } catch {
    // private browsing or storage full — silently ignore
  }
}

/**
 * Prompts the user to refresh when a newer build is deployed.
 *
 * Update detection runs on the git commit SHA (`build`), NOT the
 * human-facing version label. The SHA changes on every deploy and is
 * produced automatically — `next.config.ts` injects `NEXT_PUBLIC_BUILD_SHA`
 * at build time, and `scripts/stamp-version.ts` writes the same SHA to the
 * `app_version` row after deploy — so there is no manual version bump to
 * forget. The `version` field is now purely a cosmetic label (footer,
 * sidebar, OG image) and plays no part in update detection.
 */
export function useVersionCheck() {
  const deployed = useQuery(api.cms.appVersion.current);
  // Track which build the toast was last shown for, not just a boolean —
  // otherwise a second deploy in the same session would never re-notify.
  const shownForBuildRef = useRef<string | null>(null);

  useEffect(() => {
    if (deployed === undefined) return;
    if (deployed === null) return;

    const serverBuild = deployed.build;

    // Never nag when either side lacks a real SHA (local dev, missing git).
    if (!serverBuild || serverBuild === "dev" || serverBuild === "unknown") {
      return;
    }
    if (APP_BUILD_SHA === "dev" || APP_BUILD_SHA === "unknown") return;

    if (serverBuild === APP_BUILD_SHA) return;
    if (shownForBuildRef.current === serverBuild) return;
    if (getDismissedBuild() === serverBuild) return;

    shownForBuildRef.current = serverBuild;
    toast.info("A new version is available", {
      id: TOAST_ID,
      description:
        "A newer build has been deployed. Refresh to get the latest features and fixes.",
      duration: Infinity,
      action: {
        label: "Update now",
        onClick: () => window.location.reload(),
      },
      onDismiss: () => {
        setDismissedBuild(serverBuild);
      },
    });
  }, [deployed]);
}
