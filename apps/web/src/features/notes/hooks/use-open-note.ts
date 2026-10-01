import { NOTES_PATH, notePath } from "@wryte/logic/lib/notes/views";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";

export function useOpenNote() {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (noteId: string | null) => {
      const href = noteId ? notePath(noteId) : NOTES_PATH;
      if (pathname === href) return;
      if (pathname === NOTES_PATH || pathname.startsWith(`${NOTES_PATH}/`)) {
        window.history.pushState(null, "", href);
        return;
      }
      router.push(href);
    },
    [pathname, router],
  );
}
