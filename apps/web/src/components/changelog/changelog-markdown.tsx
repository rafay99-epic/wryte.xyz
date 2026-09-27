import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { codeComponents } from "@/components/markdown/code-overrides";
import {
  buildEmbedSanitizeSchema,
  embedComponents,
} from "@/components/markdown/embed-overrides";

const baseSchema: Options = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    ["code"]: [
      ...(defaultSchema.attributes?.["code"] ?? []),
      ["className", /^language-./],
    ],
    ["span"]: [
      ...(defaultSchema.attributes?.["span"] ?? []),
      ["className", /^hljs/],
    ],
  },
};
const sanitizeSchema = buildEmbedSanitizeSchema(baseSchema);

const components: Components = {
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-amber-500 font-medium underline decoration-amber-500/30 underline-offset-[3px] transition-colors hover:decoration-amber-500/60"
      {...props}
    >
      {children}
    </a>
  ),
};

export function ChangelogMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        rehypeRaw,
        [rehypeSanitize, sanitizeSchema],
        [rehypeHighlight, { plainText: ["mermaid"] }],
      ]}
      components={{ ...components, ...codeComponents, ...embedComponents }}
    >
      {content}
    </ReactMarkdown>
  );
}
