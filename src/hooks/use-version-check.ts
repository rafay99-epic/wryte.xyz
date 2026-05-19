"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/release";
import { api } from "../../convex/_generated/api";

const TOAST_ID = "version-update";

export function useVersionCheck() {
  const deployed = useQuery(api.cms.appVersion.current);
  const dismissedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!deployed) return;

    const isStale = deployed.version !== APP_VERSION;
    const alreadyDismissed = dismissedRef.current === deployed.version;

    if (isStale && !alreadyDismissed) {
      toast(`Version ${deployed.version} is available`, {
        id: TOAST_ID,
        description: "Refresh to get the latest features and fixes.",
        duration: Infinity,
        action: {
          label: "Update now",
          onClick: () => window.location.reload(),
        },
        onDismiss: () => {
          dismissedRef.current = deployed.version;
        },
      });
    }

    if (!isStale) {
      toast.dismiss(TOAST_ID);
    }
  }, [deployed]);
}
