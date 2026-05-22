import { motion, useInView } from "framer-motion";
import { Eye, Keyboard, Layers, Save } from "lucide-react";
import { useRef, useState } from "react";
import { editorLines } from "@/features/marketing/constants";
import { useTypewriter } from "@/features/marketing/hooks/use-typewriter";

export function EditorSection() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInView = useInView(editorRef, { once: true, margin: "-150px" });

  const {
    output,
    cursorLine,
    isDone: typewriterDone,
  } = useTypewriter(editorLines, 35, 400, 800, editorInView);

  const [editorContent, setEditorContent] = useState("");
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <section id="editor" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-[1100px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <p className="text-[13px] font-medium tracking-[0.15em] text-amber-400/60 uppercase">
            The Editor
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Where your words come alive
          </h2>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-foreground/55 dark:text-foreground/25">
            A distraction-free markdown editor with split preview, syntax
            highlighting, and keyboard shortcuts you already know.
          </p>
        </motion.div>

        <motion.div
          ref={editorRef}
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="animated-border relative"
        >
          <div className="relative overflow-hidden rounded-2xl border border-foreground/[0.2] dark:border-foreground/[0.08] bg-card shadow-2xl shadow-black/60">
            {/* Title bar */}
            <div className="flex items-center justify-between border-b border-foreground/[0.15] dark:border-foreground/[0.06] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="size-[10px] rounded-full bg-[#ff5f57]" />
                  <div className="size-[10px] rounded-full bg-[#febc2e]" />
                  <div className="size-[10px] rounded-full bg-[#28c840]" />
                </div>
                <div className="ml-3 flex items-center gap-1.5 rounded-md bg-foreground/[0.04] px-2.5 py-1">
                  <Layers className="size-3 text-foreground/75 dark:text-foreground/20" />
                  <span className="text-[11px] text-foreground/55 dark:text-foreground/25">
                    my-blog
                  </span>
                  <span className="text-[11px] text-foreground/65 dark:text-foreground/10">
                    /
                  </span>
                  <span className="text-[11px] text-foreground/70 dark:text-foreground/40">
                    shipping-faster.md
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {["Edit", "Split", "Preview"].map((mode, i) => (
                  <div
                    key={mode}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      i === 0
                        ? "bg-amber-500/15 text-amber-400"
                        : "text-foreground/75 hover:text-foreground/70 dark:text-foreground/20 dark:hover:text-foreground/40"
                    }`}
                  >
                    {mode}
                  </div>
                ))}
              </div>
            </div>

            {/* Editor + sidebar */}
            <div className="flex">
              {/* Frontmatter sidebar */}
              <div className="hidden w-56 shrink-0 border-r border-foreground/[0.12] dark:border-foreground/[0.04] p-4 lg:block">
                <div className="mb-3 text-[10px] font-semibold tracking-[0.15em] text-foreground/75 dark:text-foreground/20 uppercase">
                  Frontmatter
                </div>
                {[
                  { label: "Title", value: "Shipping Faster..." },
                  { label: "Date", value: "2026-04-07" },
                  { label: "Tags", value: "devtools, workflow" },
                  { label: "Draft", value: "false" },
                ].map((field) => (
                  <div key={field.label} className="mb-3">
                    <div className="text-[10px] font-medium text-foreground/55 dark:text-foreground/25">
                      {field.label}
                    </div>
                    <div className="mt-0.5 rounded bg-foreground/[0.03] px-2 py-1 text-[11px] text-foreground/70 dark:text-foreground/40">
                      {field.value}
                    </div>
                  </div>
                ))}

                <div className="mt-6 border-t border-foreground/[0.12] dark:border-foreground/[0.04] pt-4">
                  <div className="mb-2 text-[10px] font-semibold tracking-[0.15em] text-foreground/75 dark:text-foreground/20 uppercase">
                    Status
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    <div className="size-1.5 rounded-full bg-emerald-400" />
                    Ready to publish
                  </div>
                </div>
              </div>

              {/* Main editor area */}
              <div
                className="relative min-h-[380px] flex-1 cursor-text p-5 sm:p-6"
                onClick={() => {
                  if (typewriterDone) editorTextareaRef.current?.focus();
                }}
              >
                <div className="font-mono text-[13px] leading-[1.8] sm:text-sm">
                  {output.map((line, i) => (
                    <div key={i} className="flex">
                      <span className="mr-4 inline-block w-5 shrink-0 text-right text-foreground/65 dark:text-foreground/10 select-none">
                        {i + 1}
                      </span>
                      <span>
                        {line.startsWith("---") ? (
                          <span className="text-foreground/70 dark:text-foreground/15">
                            {line}
                          </span>
                        ) : line.startsWith("#") ? (
                          <span className="font-semibold text-foreground/80">
                            {line}
                          </span>
                        ) : line.includes(":") && i < 6 ? (
                          <>
                            <span className="text-purple-400">
                              {line.split(":")[0]}
                            </span>
                            <span className="text-foreground/75 dark:text-foreground/20">
                              :
                            </span>
                            <span className="text-amber-300/70">
                              {line.slice(line.indexOf(":") + 1)}
                            </span>
                          </>
                        ) : line.includes("**") ? (
                          <span className="text-foreground/70 dark:text-foreground/40">
                            {line.split("**").map((part, j) =>
                              j % 2 === 1 ? (
                                <span
                                  key={j}
                                  className="font-semibold text-foreground/80"
                                >
                                  {part}
                                </span>
                              ) : (
                                <span key={j}>{part}</span>
                              ),
                            )}
                          </span>
                        ) : (
                          <span className="text-foreground/65 dark:text-foreground/35">
                            {line}
                          </span>
                        )}
                        {i === cursorLine && !typewriterDone && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{
                              duration: 0.8,
                              repeat: Number.POSITIVE_INFINITY,
                              repeatType: "reverse",
                            }}
                            className="ml-px inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-amber-400"
                          />
                        )}
                      </span>
                    </div>
                  ))}

                  {typewriterDone && (
                    <div className="mt-1 flex">
                      <span className="mr-4 inline-block w-5 shrink-0 text-right text-foreground/65 dark:text-foreground/10 select-none">
                        {output.length + 1}
                      </span>
                      <div className="relative flex-1">
                        <textarea
                          ref={editorTextareaRef}
                          value={editorContent}
                          onChange={(e) => setEditorContent(e.target.value)}
                          rows={1}
                          className="w-full resize-none bg-transparent text-foreground/65 caret-amber-400 outline-none placeholder:text-foreground/25 dark:text-foreground/35 dark:placeholder:text-foreground/10"
                          placeholder="Try typing here..."
                        />
                        {editorContent === "" && (
                          <motion.span
                            animate={{ opacity: [1, 0] }}
                            transition={{
                              duration: 0.8,
                              repeat: Number.POSITIVE_INFINITY,
                              repeatType: "reverse",
                            }}
                            className="pointer-events-none absolute left-0 top-0 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-amber-400"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Status bar */}
            <div className="flex items-center justify-between border-t border-foreground/[0.12] dark:border-foreground/[0.04] px-4 py-1.5">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-foreground/70 dark:text-foreground/15">
                  Markdown
                </span>
                <span className="text-[10px] text-foreground/70 dark:text-foreground/15">
                  UTF-8
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400/50">
                <Save className="size-3" />
                Saved
              </div>
            </div>
          </div>

          {/* Floating annotations */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="absolute -right-3 top-1/4 hidden xl:block"
          >
            <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Eye className="size-3.5 text-purple-400" />
                <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                  Live Preview
                </span>
              </div>
              <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
                Toggle split view to see
                <br />
                rendered output instantly
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="absolute -left-3 bottom-1/3 hidden xl:block"
          >
            <div className="rounded-xl border border-foreground/[0.15] dark:border-foreground/[0.06] bg-card/90 p-3 shadow-xl backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Keyboard className="size-3.5 text-amber-400" />
                <span className="text-[11px] font-medium text-foreground/75 dark:text-foreground/50">
                  Keyboard First
                </span>
              </div>
              <p className="mt-1 text-[10px] text-foreground/55 dark:text-foreground/25">
                Ctrl+B, Ctrl+I, Ctrl+K
                <br />
                and more — stays native
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
