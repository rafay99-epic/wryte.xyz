import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

export function usePreAuthRetry(reset: () => void): boolean {
  const { isAuthenticated } = useConvexAuth();
  const [pending] = useState(!isAuthenticated);

  useEffect(() => {
    if (pending && isAuthenticated) reset();
  }, [pending, isAuthenticated, reset]);

  return pending;
}
