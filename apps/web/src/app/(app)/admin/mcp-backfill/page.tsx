import type { Metadata } from "next";
import { requireAdminOr404 } from "../_lib/require-admin";
import { BackfillRunner } from "./_components/backfill-runner";

export const metadata: Metadata = {
  title: "MCP backfill",
};

export default async function McpBackfillPage() {
  await requireAdminOr404();
  return <BackfillRunner />;
}
