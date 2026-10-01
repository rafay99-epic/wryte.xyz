import type { NoteStatus } from "@wryte/backend/cms/notes/_lib/model";
import { NOTE_STATUS_LABELS, nextStatus } from "@wryte/logic/lib/notes/status";
import { StatusIcon } from "./status-icon";

export function StatusToggle({
  status,
  title,
  onChange,
}: {
  status: NoteStatus;
  title: string;
  onChange: (next: NoteStatus) => void;
}) {
  const next = nextStatus(status);
  const label = `${title || "Untitled"}: ${NOTE_STATUS_LABELS[status]}. Mark as ${NOTE_STATUS_LABELS[next]}`;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      aria-label={label}
      title={`Mark as ${NOTE_STATUS_LABELS[next]}`}
      className="flex size-6 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <StatusIcon status={status} />
    </button>
  );
}
