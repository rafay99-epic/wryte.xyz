import { NextResponse } from "next/server";
import { getGithubToken } from "@/app/api/github/_lib/github-helpers";

export async function GET() {
  try {
    const result = await getGithubToken();

    if ("error" in result) {
      return NextResponse.json(
        { connected: false, error: result.error },
        { status: 401 },
      );
    }

    return NextResponse.json({ connected: true });
  } catch (_err: unknown) {
    return NextResponse.json(
      { connected: false, error: "Failed to retrieve GitHub connection" },
      { status: 500 },
    );
  }
}
