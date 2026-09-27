import { NextResponse } from "next/server";

const KNOWN_MEDIUMS = new Set(["commit", "badge"]);

export function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("utm_medium");
  const medium =
    requested && KNOWN_MEDIUMS.has(requested) ? requested : "commit";
  return NextResponse.redirect(
    new URL(`/?utm_source=github&utm_medium=${medium}`, request.url),
    302,
  );
}
