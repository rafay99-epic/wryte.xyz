import { cn } from "@wryte/logic/lib/utils";
import { AnthropicMark, OpenAIMark } from "./provider-logos";

type ToolMarkProps = {
  className?: string;
};

export function ClaudeMark({ className }: ToolMarkProps) {
  return <AnthropicMark className={cn("size-6", className)} />;
}

export function CodexMark({ className }: ToolMarkProps) {
  return <OpenAIMark className={cn("size-6", className)} />;
}

export function CursorMark({ className }: ToolMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0 text-primary", className)}
      aria-hidden
    >
      <title>Cursor</title>
      <path
        fill="currentColor"
        d="M12.56 2.35 21.65 12l-9.09 9.65L3 12l9.56-9.65Zm0 3.2L6.1 12l6.46 6.45L18.64 12l-6.08-6.45Z"
      />
      <path
        fill="currentColor"
        d="M12.56 8.05 16.3 12l-3.74 3.95L8.65 12l3.91-3.95Z"
        opacity=".55"
      />
    </svg>
  );
}

export function GenericMcpMark({ className }: ToolMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn(
        "size-6 shrink-0 text-zinc-500 dark:text-zinc-300",
        className,
      )}
      aria-hidden
    >
      <title>Generic MCP client</title>
      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
      <circle cx="18" cy="6" r="2.5" fill="currentColor" />
      <circle cx="18" cy="18" r="2.5" fill="currentColor" />
      <path
        d="m8.2 10.9 7.5-3.8M8.2 13.1l7.5 3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VSCodeMark({ className }: ToolMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={cn("size-6 shrink-0 text-[#2f80ed]", className)}
      aria-hidden
    >
      <title>VS Code</title>
      <path
        fill="currentColor"
        d="M17.2 2.3 22 4.6v14.8l-4.8 2.3-9.5-8.2L3.6 16.6 2 15.8V8.2l1.6-.8 4.1 3.1 9.5-8.2Zm.1 5.2-5.6 4.5 5.6 4.5v-9Zm-13.5 2v5l2.5-2.5-2.5-2.5Z"
      />
    </svg>
  );
}
