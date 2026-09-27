"use client";

import { api } from "@wryte/backend/_generated/api";
import { APP_BUILD_SHA } from "@wryte/logic/lib/release";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

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
  } catch {}
}

export function useVersionCheck() {
  const deployed = useQuery(api.cms.appVersion.current);
  const shownForBuildRef = useRef<string | null>(null);

  useEffect(() => {
    if (deployed === undefined) return;
    if (deployed === null) return;

    const serverBuild = deployed.build;

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
