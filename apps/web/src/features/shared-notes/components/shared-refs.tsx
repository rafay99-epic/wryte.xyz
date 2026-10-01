import type { RefInput } from "@wryte/backend/cms/notes/_lib/model";
import { REF_KIND_LABELS, refLabel } from "@wryte/logic/lib/notes/refs";
import { RefKindIcon } from "@/features/notes/components/ref-kind-icon";

export function SharedRefLinks({ refs }: { refs: readonly RefInput[] }) {
  const links = refs.filter((ref) => ref.kind !== "comment" && ref.url);
  if (links.length === 0) return null;
  return (
    <ul aria-label="References" className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {links.map((ref) => (
        <li key={`${ref.kind}:${ref.url ?? ""}`} className="min-w-0">
          <a
            href={ref.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-w-0 items-center gap-1.5 rounded text-[13px] text-white/75 outline-none hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <RefKindIcon kind={ref.kind} className="text-white/45" />
            <span className="sr-only">{REF_KIND_LABELS[ref.kind]}</span>
            <span className="truncate">{refLabel(ref)}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

export function SharedComments({ refs }: { refs: readonly RefInput[] }) {
  const comments = refs.filter((ref) => ref.kind === "comment");
  if (comments.length === 0) return null;
  return (
    <section aria-label="Comments" className="mt-8 space-y-4">
      {comments.map((ref, index) => (
        <figure
          key={`${ref.url ?? ""}:${String(index)}`}
          className="border-l-2 border-white/15 pl-4"
        >
          {ref.text && (
            <blockquote className="whitespace-pre-wrap text-sm leading-6 text-white/80">
              {ref.text}
            </blockquote>
          )}
          <figcaption className="mt-1.5 flex items-center gap-3 text-xs text-white/50">
            {ref.author && <span>{ref.author}</span>}
            {ref.url && (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded underline-offset-4 outline-none hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-white/30"
              >
                {ref.text ? "View comment" : refLabel(ref)}
              </a>
            )}
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
