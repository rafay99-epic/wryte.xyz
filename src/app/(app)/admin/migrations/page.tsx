import type { Metadata } from "next";
import { MigrationRunner } from "./_components/migration-runner";

export const metadata: Metadata = {
  title: "Migrations",
};

export default function Page() {
  return <MigrationRunner />;
}
