"use client";

import { api } from "@wryte/backend/_generated/api";
import {
  type EmbedResult,
  matchProvider,
  providerById,
  SUPPORTED_PROVIDERS,
} from "@wryte/backend/integrations/oembedProviders";
import { Button } from "@wryte/ui/button";
import { Input } from "@wryte/ui/input";
import { Label } from "@wryte/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@wryte/ui/sheet";
import { useAction } from "convex/react";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { embedMarkup } from "../lib/embed";

type EmbedInsertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (markup: string) => void;
};

const FETCH_DEBOUNCE_MS = 350;

/**
 * Drawer for embedding social posts (Twitter/X, YouTube, Vimeo, Reddit,
 * Bluesky, Spotify, Giphy, Mastodon) into the markdown editor. Paste a post
 * URL; the `oembed` action resolves it server-side and returns portable raw
 * HTML that renders in the editor preview, the draft share preview, and on
 * the published static site.
 */
export function EmbedInsertDialog({
  open,
  onOpenChange,
  onInsert,
}: EmbedInsertDialogProps) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<EmbedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolve = useAction(api.integrations.oembed.resolve);
  const resolveRef = useRef(resolve);
  useEffect(() => {
    resolveRef.current = resolve;
  }, [resolve]);

  const resetForm = useCallback(() => {
    setUrl("");
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setResult(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!matchProvider(trimmed)) {
      setResult(null);
      setError("That URL isn't a supported post embed.");
      setLoading(false);
      return;
    }

    let stale = false;
    setLoading(true);
    setError(null);
    const id = setTimeout(async () => {
      try {
        const r = await resolveRef.current({ url: trimmed });
        if (!stale) {
          setResult(r);
          setLoading(false);
        }
      } catch (err) {
        if (!stale) {
          const data = (err as { data?: { message?: string } })?.data;
          setError(
            data?.message ??
              (err instanceof Error
                ? err.message
                : "Couldn't resolve that embed."),
          );
          setResult(null);
          setLoading(false);
        }
      }
    }, FETCH_DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(id);
    };
  }, [url, open]);

  function closeDialog() {
    resetForm();
    onOpenChange(false);
  }

  function handleInsert() {
    if (!result) return;
    onInsert(embedMarkup(result));
    closeDialog();
  }

  // Reset internal state whenever the sheet closes (covers the X button and
  // escape, which only flip `open`).
  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const provider = result ? providerById(result.provider) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Insert post embed</SheetTitle>
          <SheetDescription>
            Paste a link to a tweet, YouTube video, Reddit post, and more — it
            renders as an embedded card instead of a plain URL.
          </SheetDescription>
        </SheetHeader>

        <SheetBody>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="embed-url">Post URL</Label>
              <Input
                id="embed-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://twitter.com/user/status/…"
                autoFocus
              />
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Resolving embed…
              </div>
            )}

            {error && !loading && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {result && !loading && (
              <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/30">
                <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
                  <MessageCircle className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium">
                    {provider?.label ?? "Embed"}
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  {result.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.thumbnailUrl}
                      alt=""
                      className="aspect-video w-full rounded-md object-cover"
                      loading="lazy"
                    />
                  )}
                  {result.title && (
                    <p className="text-sm font-medium leading-snug">
                      {result.title}
                    </p>
                  )}
                  {result.authorName && (
                    <p className="text-xs text-muted-foreground">
                      {result.authorUrl ? (
                        <a
                          href={result.authorUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-muted-foreground/70"
                        >
                          {result.authorName}
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        result.authorName
                      )}
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground/60">
              Supported: {SUPPORTED_PROVIDERS.map((p) => p.label).join(", ")}.
            </p>
          </div>
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={closeDialog}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={!result || loading}>
            Insert embed
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
