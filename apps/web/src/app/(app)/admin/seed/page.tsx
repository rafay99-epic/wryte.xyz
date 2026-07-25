import type { Metadata } from "next";
import { requireAdminOr404 } from "../_lib/require-admin";
import { SeedRunner } from "./_components/seed-runner";

export const metadata: Metadata = {
  title: "Seed data",
};

export default async function SeedPage() {
  await requireAdminOr404();
  return <SeedRunner />;
}
