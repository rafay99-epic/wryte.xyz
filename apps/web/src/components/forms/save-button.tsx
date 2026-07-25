import { Button } from "@wryte/ui/button";
import { Loader2 } from "lucide-react";

type SaveButtonProps = {
  onClick: () => void | Promise<void>;
  isSaving: boolean;
  /** Whether there are unsaved changes to commit. When false the button is disabled. */
  hasChanges: boolean;
  /** Label shown in the idle state. Defaults to "Save changes". */
  label?: string;
  /** Label shown while saving. Defaults to "Saving…". */
  savingLabel?: string;
};

/**
 * Settings save button — three states (idle, saving, no-changes) plus
 * built-in spinner. Replaces the dozen `<Button onClick={save}>...{isSaving && <Loader2 ...>}</Button>`
 * inlined throughout the settings tabs.
 */
export function SaveButton({
  onClick,
  isSaving,
  hasChanges,
  label = "Save changes",
  savingLabel = "Saving…",
}: SaveButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      onClick={onClick}
      disabled={isSaving || !hasChanges}
    >
      {isSaving ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          {savingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
