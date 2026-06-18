import type { Components } from "react-markdown";
import type { Options } from "rehype-sanitize";
import { cn } from "@/lib/utils";
import {
  ALLOWED_IFRAME_SRC_RE,
  providerByBlockquoteClass,
  providerByIframeSrc,
} from "../../../convex/integrations/oembedProviders";
import { SocialEmbed } from "./social-embed";

/**
 * Sanitize schema extension for post embeds, layered on top of any base
 * schema. Allows:
 *  - `<iframe>` whose `src` matches the whitelisted embed-domain regex
 *    (the single source of truth from the provider registry).
 *  - Blockquote-based embeds (`twitter-tweet`, `tiktok-embed`, …) with the
 *    data-* / style options their oEmbed markup carries.
 *
 * `rehype-sanitize` works on hast property names (camelCased), so the
 * attribute keys here are hast names (`className`, `allowFullScreen`,
 * `dataDnt`, …), not HTML attribute names.
 */
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
        // `cite` is already in the base schema; the rest supports blockquote
        // embeds (Twitter/X data-* options, TikTok data-video-id / style-free).
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
      // Embed oEmbed markup carries target/title on its fallback links.
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

/**
 * Shared `react-markdown` component overrides for embeds. Used by every
 * markdown surface (editor markdown preview, MDX preview, draft share
 * preview) so embeds render identically everywhere.
 *
 * - `iframe`: derives layout from the src domain (whitelisted embeds get a
 *   responsive wrapper; unknown iframes — only reachable in trusted MDX —
 *   render sandboxed). A `height` from oEmbed is honoured for bar/fluid
 *   players (SoundCloud, Spotify) so the provider's chosen height wins over
 *   the default.
 * - `blockquote`: embeds whose class matches a registered blockquote
 *   provider (Twitter/X, TikTok) hydrate via `SocialEmbed` with the
 *   provider's loader; everything else keeps the standard styled quote.
 */
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
    // oEmbed iframes often carry an explicit height (e.g. SoundCloud 166,
    // Spotify 152). Parse it so the wrapper respects the provider's layout.
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
        // TikTok oEmbed ships a max-width:605px inline style; sanitize strips
        // inline styles, so cap the width here for the same portrait framing.
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
