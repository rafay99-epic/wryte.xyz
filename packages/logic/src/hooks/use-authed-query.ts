"use client";

import { useConvexAuth, useQuery } from "convex/react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

export function useAuthedQuery<Query extends FunctionReference<"query">>(
  query: Query,
  args: FunctionArgs<Query> | "skip",
): FunctionReturnType<Query> | undefined {
  const { isAuthenticated } = useConvexAuth();
  return useQuery(query, isAuthenticated ? args : "skip");
}
