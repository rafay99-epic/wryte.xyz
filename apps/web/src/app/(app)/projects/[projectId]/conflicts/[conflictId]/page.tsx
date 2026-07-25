import type { Metadata } from "next";
import { ConflictPage } from "@/features/sync-conflicts/conflict-page";

export const metadata: Metadata = {
  title: "Sync conflict",
};

export default function Page() {
  return <ConflictPage />;
}
