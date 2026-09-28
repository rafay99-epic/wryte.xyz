import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";
import { QUOTAS } from "../_lib/quotas";
import { extensionForMime } from "../media/_lib/remote";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "object" && data !== null && "message" in data) {
      return String(data.message);
    }
    return String(data);
  }
  return error instanceof Error ? error.message : String(error);
}

const TOO_LARGE = `File is larger than ${String(QUOTAS.MAX_UPLOAD_BYTES)} bytes`;

export const mediaUploadRoute = httpAction(async (ctx, request) => {
  const token = new URL(request.url).searchParams.get("ticket");
  if (!token) return json(400, { error: "Missing ticket" });

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > QUOTAS.MAX_UPLOAD_BYTES) {
    return json(413, { error: TOO_LARGE });
  }

  const ticket = await ctx.runMutation(
    internal.mcp.handlers.media.redeemTicket,
    { token },
  );
  if (!ticket) {
    return json(401, {
      error:
        "This upload URL is invalid, used or expired. Get a new one from wryte_media_upload_url.",
    });
  }

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return json(400, { error: "Empty body" });
  if (bytes.byteLength > QUOTAS.MAX_UPLOAD_BYTES) {
    return json(413, { error: TOO_LARGE });
  }

  const mime =
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ??
    "";
  const filename =
    ticket.filename ??
    request.headers.get("x-filename") ??
    `upload.${extensionForMime(mime)}`;

  try {
    const result = await ctx.runAction(
      internal.mcp.handlers.nodeActions.uploadFromTicket,
      {
        userId: ticket.userId,
        projectId: ticket.projectId,
        bytes,
        mime,
        filename,
        ...(ticket.alt !== undefined ? { alt: ticket.alt } : {}),
        ...(ticket.documentId !== undefined
          ? { documentId: ticket.documentId }
          : {}),
      },
    );
    return json(200, result);
  } catch (error) {
    return json(400, { error: errorMessage(error) });
  }
});
