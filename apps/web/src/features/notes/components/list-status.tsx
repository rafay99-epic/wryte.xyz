import { Button } from "@wryte/ui/button";
import type { ReactNode } from "react";

export function ListMessage({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  );
}

export function ListFooter({
  status,
  onLoadMore,
}: {
  status: "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
  onLoadMore: () => void;
}) {
  if (status !== "CanLoadMore" && status !== "LoadingMore") return null;
  return (
    <div className="flex justify-center p-2">
      <Button
        variant="ghost"
        size="sm"
        disabled={status === "LoadingMore"}
        onClick={onLoadMore}
      >
        {status === "LoadingMore" ? "Loading" : "Load more"}
      </Button>
    </div>
  );
}
