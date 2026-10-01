export function NotePaneSkeleton({ noteOpen = false }: { noteOpen?: boolean }) {
  return (
    <div
      data-note-open={noteOpen ? "" : undefined}
      aria-hidden
      className="flex h-full flex-col gap-3 p-4"
    >
      <div className="h-7 w-64 rounded-md bg-muted/40" />
      <div className="h-6 w-96 max-w-full rounded-md bg-muted/30" />
      <div className="min-h-0 flex-1 rounded-md bg-muted/20" />
    </div>
  );
}
