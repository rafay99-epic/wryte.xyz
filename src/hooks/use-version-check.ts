"use client";

import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/release";
import { api } from "../../convex/_generated/api";

const TOAST_ID = "version-update";

/**
 * Subscribes to the deployed app version via Convex's real-time
 * websocket. When the server-side version changes and no longer
 * matches the build-time APP_VERSION baked into this bundle, a
 * persistent toast prompts the user to refresh.
 */
export function useVersionCheck() {
  const deployed = useQuery(api.cms.appVersion.current);
  const dismissedRef = useRef<string | null>(null);
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (deployed === undefined) return;
    if (deployed === null) return;

    const serverVersion = deployed.version;
    const isStale = serverVersion !== APP_VERSION;

    if (
      isStale &&
      !hasNotifiedRef.current &&
      dismissedRef.current !== serverVersion
    ) {
      hasNotifiedRef.current = true;
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
          dismissedRef.current = serverVersion;
          hasNotifiedRef.current = false;
        },
      });
    }
  }, [deployed]);
}
