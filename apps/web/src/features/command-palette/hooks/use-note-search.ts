import { api } from "@wryte/backend/_generated/api";
import type { SearchHit } from "@wryte/backend/cms/notes/_lib/model";
import { useConvex, useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

type Settled = { term: string; hits: SearchHit[] };

const NO_HITS: SearchHit[] = [];

export function useNoteSearch(term: string): SearchHit[] | undefined {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!term || !isAuthenticated) return;
    let cancelled = false;
    convex.query(api.cms.notes.notes.search, { query: term }).then(
      (hits) => {
        if (!cancelled) setSettled({ term, hits });
      },
      (error: unknown) => {
        console.error("[Palette] Note search failed:", error);
        if (!cancelled) setSettled({ term, hits: NO_HITS });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [convex, term, isAuthenticated]);

  if (!term) return NO_HITS;
  return settled?.term === term ? settled.hits : undefined;
}
