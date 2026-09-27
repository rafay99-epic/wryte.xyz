import {
  ALLOWED_IFRAME_SRC_RE,
  providerByBlockquoteClass,
  providerByIframeSrc,
} from "@wryte/backend/integrations/oembedProviders";
import { cn } from "@wryte/logic/lib/utils";
import type { Components } from "react-markdown";
import type { Options } from "rehype-sanitize";
import { SocialEmbed } from "./social-embed";

export function buildEmbedSanitizeSchema(base: Options): Options {
  return {
    ...base,
    tagNames: [...(base.tagNames ?? []), "iframe"],
    attributes: {
      ...base.attributes,
      ["iframe"]: [
        ["src", ALLOWED_IFRAME_SRC_RE],
        "width",
        "height",
        "allow",
        "allowFullScreen",
        "frameBorder",
        "loading",
        "title",
        "className",
      ],
      ["blockquote"]: [
        ...(base.attributes?.["blockquote"] ?? []),
        "className",
        "dataVideoId",
        "dataEmbedFrom",
        "dataDnt",
        "dataConversation",
        "dataTheme",
        "dataAlign",
        "dataCards",
        "dataWidth",
        "dir",
        "lang",
      ],
      ["section"]: [...(base.attributes?.["section"] ?? []), "dir", "lang"],
      ["p"]: [...(base.attributes?.["p"] ?? []), "dir", "lang", "className"],
      ["a"]: [
        ...(base.attributes?.["a"] ?? []),
        "dir",
        "lang",
        "title",
        "target",
        "rel",
      ],
      ["span"]: [
        ...(base.attributes?.["span"] ?? []),
        "className",
        "dir",
        "lang",
      ],
    },
  };
}

const EMBED_WRAPPER =
  "social-embed not-prose my-6 overflow-hidden rounded-xl border border-border/40 shadow-sm";

export const embedComponents: Components = {
  iframe: ({ node: _node, src, height, title, ...props }) => {
    const srcStr = typeof src === "string" ? src : null;
    if (!srcStr) return null;

    if (!ALLOWED_IFRAME_SRC_RE.test(srcStr)) {
      return (
        <iframe
          {...props}
          src={srcStr}
          loading="lazy"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
          className="my-6 w-full max-w-full rounded-xl border border-border/40"
        />
      );
    }

    const provider = providerByIframeSrc(srcStr);
    const aspect = provider?.aspect ?? "fluid";
    const resolvedTitle =
      typeof title === "string" ? title : (provider?.label ?? "Embed");
    const explicitHeight =
      typeof height === "number"
        ? height
        : typeof height === "string"
          ? Number.parseInt(height, 10) || null
          : null;

    if (aspect === "video") {
      return (
        <div className={EMBED_WRAPPER}>
          <div className="relative aspect-video w-full">
            <iframe
              {...props}
              src={srcStr}
              title={resolvedTitle}
              loading="lazy"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />
          </div>
        </div>
      );
    }

    if (aspect === "bar") {
      return (
        <div className={EMBED_WRAPPER}>
          <iframe
            {...props}
            src={srcStr}
            title={resolvedTitle}
            loading="lazy"
            allowFullScreen
            className="w-full border-0"
            style={{ height: explicitHeight ?? 152 }}
          />
        </div>
      );
    }

    return (
      <div className={EMBED_WRAPPER}>
        <iframe
          {...props}
          src={srcStr}
          title={resolvedTitle}
          loading="lazy"
          allowFullScreen
          className="w-full border-0"
          style={
            explicitHeight ? { height: explicitHeight } : { minHeight: 200 }
          }
        />
      </div>
    );
  },

  blockquote: ({ node: _node, className, children, ...props }) => {
    if (typeof className === "string") {
      const provider = providerByBlockquoteClass(className);
      if (provider?.loader) {
        const widthCap =
          provider.id === "tiktok" ? "mx-auto max-w-[605px]" : "";
        return (
          <SocialEmbed
            loader={provider.loader}
            className={cn(className, widthCap)}
            {...props}
          >
            {children}
          </SocialEmbed>
        );
      }
    }
    return (
      <blockquote
        className={cn(
          "border-l-[3px] border-primary/40 pl-4 italic text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </blockquote>
    );
  },
};
