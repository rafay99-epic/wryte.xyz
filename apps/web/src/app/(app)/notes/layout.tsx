import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NotesShell } from "@/features/notes/notes-shell";

export const metadata: Metadata = {
  title: "Notes",
};

export default function NotesLayout({ children }: { children: ReactNode }) {
  return <NotesShell>{children}</NotesShell>;
}
