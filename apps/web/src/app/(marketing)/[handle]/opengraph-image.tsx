import { api } from "@wryte/backend/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { ImageResponse } from "next/og";
import { accentHex } from "@/features/profile/accents";

export const alt = "Writing profile on Wryte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Dynamic share card — generated per request, no stored file. Reflects the
 * live profile (name, handle, accent, post count, streak) so a shared link
 * always looks current. Falls back to a neutral Wryte card if the handle
 * isn't a public profile.
 */
export default async function OgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);
  const username = decoded.startsWith("@")
    ? decoded.slice(1).toLowerCase()
    : "";

  const convexUrl = process.env["NEXT_PUBLIC_CONVEX_URL"];
  let profile: Awaited<ReturnType<ConvexHttpClient["query"]>> | null = null;
  if (username && convexUrl) {
    try {
      profile = await new ConvexHttpClient(convexUrl).query(
        api.profiles.getPublicProfile,
        { username },
      );
    } catch {
      profile = null;
    }
  }

  const p = profile as {
    name?: string;
    username?: string;
    bio?: string;
    accent?: string;
    stats?: { totalPublished: number; currentStreak: number };
  } | null;

  const accent = accentHex(p?.accent);
  const name = p?.name ?? "Wryte";
  const uname = p?.username ?? username;
  const bio = p?.bio;
  const published = p?.stats?.totalPublished;
  const streak = p?.stats?.currentStreak;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px",
        background: "#0b0d10",
        backgroundImage: `radial-gradient(ellipse 900px 500px at 50% -10%, ${accent}33, transparent)`,
        color: "#e8ebf0",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "120px",
            height: "120px",
            borderRadius: "9999px",
            background: accent,
            color: "#ffffff",
            fontSize: "56px",
            fontWeight: 700,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "60px", fontWeight: 700, lineHeight: 1.1 }}>
            {name}
          </div>
          <div style={{ fontSize: "30px", color: accent, fontWeight: 600 }}>
            @{uname}
          </div>
        </div>
      </div>

      {bio ? (
        <div
          style={{
            display: "flex",
            fontSize: "30px",
            color: "#98a2b3",
            maxWidth: "1000px",
            lineHeight: 1.4,
          }}
        >
          {bio.length > 140 ? `${bio.slice(0, 140)}…` : bio}
        </div>
      ) : (
        <div style={{ display: "flex" }} />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: "40px" }}>
          {published !== undefined && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "44px", fontWeight: 700 }}>
                {published.toLocaleString()}
              </span>
              <span style={{ fontSize: "22px", color: "#98a2b3" }}>
                published
              </span>
            </div>
          )}
          {streak !== undefined && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "44px", fontWeight: 700 }}>
                {streak}d
              </span>
              <span style={{ fontSize: "22px", color: "#98a2b3" }}>streak</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: "26px", color: "#5eead4" }}>
          wryte.xyz
        </div>
      </div>
    </div>,
    { ...size },
  );
}
