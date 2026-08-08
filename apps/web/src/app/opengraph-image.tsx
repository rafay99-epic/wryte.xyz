import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION_LABEL } from "@wryte/logic/lib/release";
import { ImageResponse } from "next/og";

export const alt = "Wryte – Write Now, Publish Later";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const socialData = readFileSync(
    join(process.cwd(), "public", "og-social.png"),
  );
  const socialSrc = `data:image/png;base64,${socialData.toString("base64")}`;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#09090b",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow — amber, top-left */}
      <div
        style={{
          position: "absolute",
          top: "-120px",
          left: "5%",
          width: "500px",
          height: "400px",
          borderRadius: "9999px",
          backgroundImage:
            "radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Ambient glow — purple, bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: "-100px",
          right: "5%",
          width: "450px",
          height: "350px",
          borderRadius: "9999px",
          backgroundImage:
            "radial-gradient(circle, rgba(147,51,234,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Social image — centered, full height */}
      <img
        src={socialSrc}
        alt="Wryte logo"
        width={580}
        height={580}
        style={{ borderRadius: "24px" }}
      />

      {/* Bottom — domain + version */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "14px",
          color: "rgba(255,255,255,0.12)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <span>wryte.xyz</span>
        <span>&middot;</span>
        <span>{APP_VERSION_LABEL}</span>
      </div>
    </div>,
    { ...size },
  );
}
