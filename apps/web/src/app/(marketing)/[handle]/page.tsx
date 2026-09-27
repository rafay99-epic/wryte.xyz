import { api } from "@wryte/backend/_generated/api";
import { absoluteUrl, SITE_NAME } from "@wryte/logic/lib/seo";
import { ConvexHttpClient } from "convex/browser";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import {
  PublicProfile,
  type PublicProfileData,
} from "@/features/profile/public-profile";
import { ProfileLoading } from "./_components/profile-loading";

type LoadResult = {
  profile: PublicProfileData;
  preview: { isPublic: boolean } | null;
} | null;

const loadProfile = cache(
  async (
    handleParam: string,
    token: string | undefined,
  ): Promise<LoadResult> => {
    const decoded = decodeURIComponent(handleParam);
    if (!decoded.startsWith("@")) return null;
    const username = decoded.slice(1).toLowerCase();

    const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"];
    if (!convexUrl) return null;
    const client = new ConvexHttpClient(convexUrl);

    if (token) {
      const res = await client.query(api.profiles.getProfilePreview, {
        username,
        token,
      });
      return res
        ? { profile: res.profile, preview: { isPublic: res.isPublic } }
        : null;
    }

    const profile = await client.query(api.profiles.getPublicProfile, {
      username,
    });
    return profile ? { profile, preview: null } : null;
  },
);

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const { preview } = await searchParams;
  const result = await loadProfile(handle, preview);
  if (!result) {
    return {
      title: "Profile not found",
      robots: { index: false },
    };
  }
  const { profile } = result;
  const title = `${profile.name} (@${profile.username})`;
  const socialTitle = `${title} · ${SITE_NAME}`;
  const description =
    profile.bio || `${profile.name}'s published writing on ${SITE_NAME}.`;
  const url = absoluteUrl(`/@${profile.username}`);
  if (result.preview) {
    return { title: `${title} · Preview`, robots: { index: false } };
  }
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: socialTitle, description, url, type: "profile" },
    twitter: { card: "summary", title: socialTitle, description },
  };
}

async function ProfileContent({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { handle } = await params;
  const { preview } = await searchParams;
  const result = await loadProfile(handle, preview);
  if (!result) notFound();
  return (
    <PublicProfile
      profile={result.profile}
      {...(result.preview ? { preview: result.preview } : {})}
    />
  );
}

export default function ProfilePage(props: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  return (
    <Suspense fallback={<ProfileLoading />}>
      <ProfileContent {...props} />
    </Suspense>
  );
}
