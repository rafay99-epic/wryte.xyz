import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const MAX_BIO = 280;
export const MAX_LINKS = 6;

export type SocialLink = { label: string; url: string };

function reportError(err: unknown, fallback: string) {
  const data = (err as { data?: { message?: string } })?.data;
  const message =
    data?.message ?? (err instanceof Error ? err.message : fallback);
  toast.error(message);
}

export function useProfileTab() {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const profile = useQuery(api.profiles.getMyProfile);
  const posts = useQuery(api.profiles.myPublishedPosts);
  const setMyUsername = useMutation(api.profiles.setMyUsername);
  const update = useMutation(api.profiles.updateProfile);
  const ensurePreview = useMutation(api.profiles.ensurePreviewToken);

  const clerkUsername = clerkUser?.username ?? null;

  const [isSyncing, setIsSyncing] = useState(false);
  const [bio, setBio] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [isSavingFeed, setIsSavingFeed] = useState(false);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await setMyUsername({ username: clerkUsername });
    } catch (err) {
      reportError(err, "Failed to refresh username");
    } finally {
      setIsSyncing(false);
    }
  }, [setMyUsername, clerkUsername]);

  // Mirror the Clerk username into Convex once it's loaded (and whenever it
  // changes). Client-side — Clerk is the source of truth and useUser already
  // has it, so no server SDK call.
  useEffect(() => {
    if (!clerkLoaded) return;
    void setMyUsername({ username: clerkUsername }).catch(() => {});
  }, [clerkLoaded, clerkUsername, setMyUsername]);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio);
    setLinks(profile.socialLinks);
    setFeedUrl(profile.feedUrl);
  }, [profile]);

  const isBioDirty =
    profile !== null && profile !== undefined && bio !== profile.bio;
  const isLinksDirty =
    profile !== null &&
    profile !== undefined &&
    JSON.stringify(links) !== JSON.stringify(profile.socialLinks);
  const isFeedDirty =
    profile !== null && profile !== undefined && feedUrl !== profile.feedUrl;

  const handleTogglePublic = useCallback(
    async (checked: boolean) => {
      try {
        await update({ profilePublic: checked });
        toast.success(
          checked ? "Profile is now public" : "Profile is now private",
        );
      } catch (err) {
        reportError(err, "Failed to update visibility");
      }
    },
    [update],
  );

  const handleToggleStats = useCallback(
    async (checked: boolean) => {
      try {
        await update({ profileShowStats: checked });
        toast.success(
          checked ? "Stats now visible on profile" : "Stats hidden",
        );
      } catch (err) {
        reportError(err, "Failed to update setting");
      }
    },
    [update],
  );

  const handleSetAccent = useCallback(
    async (accent: string) => {
      try {
        await update({ profileAccent: accent });
        toast.success("Accent updated");
      } catch (err) {
        reportError(err, "Failed to update accent");
      }
    },
    [update],
  );

  const handleSetFeatured = useCallback(
    async (documentId: Id<"documents"> | null) => {
      try {
        await update({ featuredDocumentId: documentId });
        toast.success(
          documentId ? "Featured post set" : "Featured post cleared",
        );
      } catch (err) {
        reportError(err, "Failed to update featured post");
      }
    },
    [update],
  );

  const handleSaveFeed = useCallback(async () => {
    setIsSavingFeed(true);
    try {
      await update({ feedUrl });
      toast.success("Feed URL saved");
    } catch (err) {
      reportError(err, "Failed to save feed URL");
    } finally {
      setIsSavingFeed(false);
    }
  }, [feedUrl, update]);

  const handleSaveBio = useCallback(async () => {
    setIsSavingBio(true);
    try {
      await update({ bio });
      toast.success("Bio saved");
    } catch (err) {
      reportError(err, "Failed to save bio");
    } finally {
      setIsSavingBio(false);
    }
  }, [bio, update]);

  const handleSaveLinks = useCallback(async () => {
    setIsSavingLinks(true);
    try {
      await update({ socialLinks: links });
      toast.success("Links saved");
    } catch (err) {
      reportError(err, "Failed to save links");
    } finally {
      setIsSavingLinks(false);
    }
  }, [links, update]);

  const addLink = useCallback(() => {
    setLinks((prev) =>
      prev.length >= MAX_LINKS ? prev : [...prev, { label: "", url: "" }],
    );
  }, []);

  const removeLink = useCallback((index: number) => {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateLink = useCallback(
    (index: number, patch: Partial<SocialLink>) => {
      setLinks((prev) =>
        prev.map((l, i) => (i === index ? { ...l, ...patch } : l)),
      );
    },
    [],
  );

  const buildPreviewUrl = useCallback(async (): Promise<string | null> => {
    if (!profile?.username) {
      toast.error("Set a username first.");
      return null;
    }
    let token = profile.previewToken;
    if (!token) {
      try {
        token = await ensurePreview({
          token: crypto.randomUUID().replace(/-/g, ""),
        });
      } catch (err) {
        reportError(err, "Couldn't create a preview link");
        return null;
      }
    }
    return `${window.location.origin}/@${profile.username}?preview=${token}`;
  }, [profile, ensurePreview]);

  const handleOpenPreview = useCallback(async () => {
    const url = await buildPreviewUrl();
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }, [buildPreviewUrl]);

  const handleCopyPreview = useCallback(async () => {
    const url = await buildPreviewUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Preview link copied");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }, [buildPreviewUrl]);

  return {
    profile,
    isSyncing,
    handleSync,
    bio,
    setBio,
    isBioDirty,
    isSavingBio,
    handleSaveBio,
    links,
    isLinksDirty,
    isSavingLinks,
    handleSaveLinks,
    addLink,
    removeLink,
    updateLink,
    handleTogglePublic,
    handleToggleStats,
    handleOpenPreview,
    handleCopyPreview,
    handleSetAccent,
    posts,
    handleSetFeatured,
    feedUrl,
    setFeedUrl,
    isFeedDirty,
    isSavingFeed,
    handleSaveFeed,
  };
}
