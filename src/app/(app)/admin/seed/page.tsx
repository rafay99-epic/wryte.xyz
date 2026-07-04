import type { Metadata } from "next";
import { requireAdminOr404 } from "../_lib/require-admin";
import { CostOptTestBench } from "./_components/cost-opt-test-bench";
import { SeedRunner } from "./_components/seed-runner";

export const metadata: Metadata = {
  title: "Seed data",
};

export default async function SeedPage() {
  await requireAdminOr404();
  return (
    <>
      <SeedRunner />
      <div className="mx-auto max-w-3xl px-6 pb-10">
        <CostOptTestBench />
      </div>
    </>
  );
}
