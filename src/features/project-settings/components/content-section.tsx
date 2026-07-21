"use client";

import { motion } from "framer-motion";
import { Check, FolderTree } from "lucide-react";
import { SaveBar } from "@/components/settings/save-bar";
import { Input } from "@/components/ui/input";
import type { ContentFormat } from "@/lib/content-format";
import { smoothTransition, staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useContentSection } from "../hooks/use-content-section";
import type { ProjectData } from "../types";
import { FieldGroup, SectionHeader, ToggleRow } from "./shared";

export function ContentSection({
  projectId,
  project,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const {
    contentPath,
    setContentPath,
    contentFormat,
    filenamePattern,
    setFilenamePattern,
    animationsPath,
    setAnimationsPath,
    animationsOn,
    setAnimationsOn,
    defaultPattern,
    isSaving,
    hasChanges,
    handleSave,
    handleFormatChange,
  } = useContentSection({ projectId, project });

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <SectionHeader
        icon={FolderTree}
        title="Content Structure"
        description="Where your content files live and how they're named"
      />

      <motion.div
        variants={staggerItem}
        transition={smoothTransition}
        className="space-y-4"
      >
        <FieldGroup
          label="Content Directory"
          htmlFor="s-content-path"
          hint="Where content files are published."
        >
          <Input
            id="s-content-path"
            value={contentPath}
            onChange={(e) => setContentPath(e.target.value)}
            placeholder="content/blog"
            className="font-mono text-sm"
          />
        </FieldGroup>

        <FieldGroup
          label="Content Format"
          hint={
            contentFormat === "mdx"
              ? "MDX lets you embed interactive React components inside markdown. Components use React hooks (useState, useEffect, etc.) and are rendered live in the editor preview. Only React is supported — Vue, Svelte, and other frameworks are not compatible. Changing format only affects future publishes."
              : "Standard markdown with no component support. Changing format only affects future publishes."
          }
        >
          <div className="grid max-w-md grid-cols-2 gap-3">
            <FormatOptionCard
              format="md"
              active={contentFormat === "md"}
              onClick={() => handleFormatChange("md")}
            />
            <FormatOptionCard
              format="mdx"
              active={contentFormat === "mdx"}
              onClick={() => handleFormatChange("mdx")}
            />
          </div>
        </FieldGroup>

        <FieldGroup
          label="Filename Pattern"
          htmlFor="s-filename"
          hint="Variables: {{slug}}, {{date}}, {{year}}, {{month}}, {{day}}"
        >
          <Input
            id="s-filename"
            value={filenamePattern}
            onChange={(e) => setFilenamePattern(e.target.value)}
            placeholder={defaultPattern}
            className="max-w-sm font-mono text-sm"
          />
        </FieldGroup>

        {contentFormat === "mdx" && (
          <>
            <ToggleRow
              title="Code animations"
              line="Author live React components, publish them as .tsx files in your repo"
              info="MDX-only. When enabled, the editor gains Insert → Animation and the /animation slash command, and an Animations gallery appears in the sidebar. Publishing commits each referenced component into the directory below and wires the import into your post automatically."
              checked={animationsOn}
              onCheckedChange={setAnimationsOn}
            />
            {animationsOn && (
              <FieldGroup
                label="Animations Directory"
                htmlFor="s-animations-path"
                hint="Repo folder where the .tsx components are committed on publish, e.g. src/components/blog. Your site must be set up to compile React components (e.g. @astrojs/react for Astro)."
              >
                <Input
                  id="s-animations-path"
                  value={animationsPath}
                  onChange={(e) => setAnimationsPath(e.target.value)}
                  placeholder="src/components/blog"
                  className="font-mono text-sm"
                />
              </FieldGroup>
            )}
          </>
        )}

        <SaveBar
          hasChanges={hasChanges}
          isSaving={isSaving}
          onSave={handleSave}
        />
      </motion.div>
    </motion.div>
  );
}

const FORMAT_META: Record<
  ContentFormat,
  { label: string; extension: string; tagline: string }
> = {
  md: {
    label: "Markdown",
    extension: ".md",
    tagline: "Plain markdown",
  },
  mdx: {
    label: "MDX",
    extension: ".mdx",
    tagline: "Markdown + React components",
  },
};

function FormatOptionCard({
  format,
  active,
  onClick,
}: {
  format: ContentFormat;
  active: boolean;
  onClick: () => void;
}) {
  const meta = FORMAT_META[format];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-3 rounded-xl border bg-card px-4 py-5 text-center transition-all",
        active
          ? "border-primary/60 bg-primary/5 ring-2 ring-primary/30"
          : "border-input hover:border-foreground/30 hover:bg-muted/40",
      )}
    >
      {active && (
        <span className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      )}
      <FormatLogo format={format} />
      <div className="space-y-0.5">
        <p className="text-sm font-semibold leading-none">{meta.label}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {meta.extension}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground/70">{meta.tagline}</p>
    </button>
  );
}

function FormatLogo({ format }: { format: ContentFormat }) {
  if (format === "md") {
    // SVGL ships two theme-specific Markdown logos — swap with Tailwind's
    // `dark:` variant so each variant is preloaded and there's no flash.
    return (
      <div className="flex h-12 w-20 items-center justify-center">
        <img
          src="https://svgl.app/library/markdown-light.svg"
          alt="Markdown"
          className="block h-full w-full object-contain dark:hidden"
          loading="lazy"
          decoding="async"
        />
        <img
          src="https://svgl.app/library/markdown-dark.svg"
          alt="Markdown"
          className="hidden h-full w-full object-contain dark:block"
          loading="lazy"
          decoding="async"
        />
      </div>
    );
  }
  // SVGL has no MDX entry — inline the canonical yellow MDX mark, which
  // reads well on both light and dark backgrounds without theme swapping.
  return <MdxLogo />;
}

/** Official MDX wordmark on its signature yellow rounded background. */
function MdxLogo() {
  return (
    <svg
      viewBox="0 0 138 57"
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-20"
      aria-label="MDX"
      role="img"
    >
      <title>MDX</title>
      <rect width="138" height="57" rx="6" fill="#FCB32C" />
      <path
        d="M18 41V20h6l8 10 8-10h6v21h-6V29l-8 10-8-10v12zM62 41V20h10c5 0 9 5 9 10s-4 11-9 11zm6-5h4c2 0 3-2 3-6s-1-5-3-5h-4zM92 41l-6-10 6-11h6l-3 5 4 6 4-6-3-5h6l-6 11 6 10h-6l-4-7-4 7z"
        fill="#000"
      />
    </svg>
  );
}
