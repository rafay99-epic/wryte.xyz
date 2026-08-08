import type { Metadata } from "next";
import { SeedRunner } from "./_components/seed-runner";

export const metadata: Metadata = {
  title: "Seed data",
};

export default function SeedPage() {
  return <SeedRunner />;
}
