"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/release";
import { api } from "../../convex/_generated/api";

const TOAST_ID = "version-update";
const STORAGE_KEY = "wryte:dismissed-version";

function getDismissedVersion(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function setDismissedVersion(version: string) {
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // private browsing or storage full — silently ignore
  }
}

export function useVersionCheck() {
  const deployed = useQuery(api.cms.appVersion.current);
  const shownRef = useRef(false);

  useEffect(() => {
    if (deployed === undefined) return;
    if (deployed === null) return;

    const serverVersion = deployed.version;

    if (serverVersion === APP_VERSION) return;

    if (shownRef.current) return;
    if (getDismissedVersion() === serverVersion) return;

    shownRef.current = true;
    toast.info(`Version ${serverVersion} is available`, {
      id: TOAST_ID,
      description:
        "A new version has been deployed. Refresh to get the latest features and fixes.",
      duration: Infinity,
      action: {
        label: "Update now",
        onClick: () => window.location.reload(),
      },
      onDismiss: () => {
        setDismissedVersion(serverVersion);
      },
    });
  }, [deployed]);
}
