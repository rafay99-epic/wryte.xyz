const PRIVATE_HOST =
  /^(localhost|.*\.localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[.*\])$/i;

export function parseRemoteMediaUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("sourceUrl is not a valid URL");
  }
  if (url.protocol !== "https:") {
    throw new Error("sourceUrl must use https");
  }
  if (PRIVATE_HOST.test(url.hostname)) {
    throw new Error("sourceUrl must point at a public host");
  }
  return url;
}

export function extensionForMime(mime: string): string {
  const subtype = mime.split("/")[1]?.split("+")[0] ?? "";
  return subtype === "jpeg" ? "jpg" : subtype || "bin";
}

export function filenameFromUrl(url: URL, mime: string): string {
  const last = decodeURIComponent(url.pathname.split("/").pop() ?? "").trim();
  if (last.includes(".")) return last;
  return `${last || "image"}.${extensionForMime(mime)}`;
}

export function mediaMarkdown(
  mime: string,
  url: string,
  alt: string | undefined,
): string | null {
  if (!mime.startsWith("image/")) return null;
  return `![${(alt ?? "").replace(/[[\]]/g, "")}](${url})`;
}

export async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`File is larger than ${String(maxBytes)} bytes`);
  }
  if (!response.body) return new ArrayBuffer(0);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`File is larger than ${String(maxBytes)} bytes`);
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}
