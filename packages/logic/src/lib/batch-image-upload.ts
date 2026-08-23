export const MAX_BATCH_IMAGES = 10;
export const BATCH_UPLOAD_CONCURRENCY = 2;

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

export type BatchUploadStage = "compressing" | "watermark" | "uploading";

export type BatchUploadStatus =
  | { kind: "queued" }
  | { kind: "processing"; stage: BatchUploadStage }
  | {
      kind: "success";
      url: string;
      savings: string;
    }
  | { kind: "error"; message: string };

export type BatchImageItem = {
  id: string;
  file: File;
  altText: string;
  status: BatchUploadStatus;
};

export type BatchSelectionIssue = {
  kind: "unsupported" | "duplicate" | "limit";
  filename: string;
};

export type BatchSelectionResult = {
  items: BatchImageItem[];
  issues: BatchSelectionIssue[];
};

export type BatchImageAction =
  | { kind: "replace"; items: BatchImageItem[] }
  | { kind: "remove"; id: string }
  | { kind: "set-alt"; id: string; altText: string }
  | { kind: "set-status"; id: string; status: BatchUploadStatus }
  | { kind: "queue-failed" }
  | { kind: "clear" };

function fileIdentity(file: File): string {
  return [file.name, file.size, file.lastModified, file.type].join(":");
}

export function imageAltFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function addBatchImages(
  existing: BatchImageItem[],
  incoming: Iterable<File>,
): BatchSelectionResult {
  const items = [...existing];
  const issues: BatchSelectionIssue[] = [];
  const identities = new Set(items.map((item) => fileIdentity(item.file)));

  for (const file of incoming) {
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
      issues.push({ kind: "unsupported", filename: file.name });
      continue;
    }

    const identity = fileIdentity(file);
    if (identities.has(identity)) {
      issues.push({ kind: "duplicate", filename: file.name });
      continue;
    }

    if (items.length >= MAX_BATCH_IMAGES) {
      issues.push({ kind: "limit", filename: file.name });
      continue;
    }

    identities.add(identity);
    items.push({
      id: crypto.randomUUID(),
      file,
      altText: imageAltFromFilename(file.name),
      status: { kind: "queued" },
    });
  }

  return { items, issues };
}

export function batchImageReducer(
  items: BatchImageItem[],
  action: BatchImageAction,
): BatchImageItem[] {
  switch (action.kind) {
    case "replace":
      return action.items;
    case "remove":
      return items.filter((item) => item.id !== action.id);
    case "set-alt":
      return items.map((item) =>
        item.id === action.id ? { ...item, altText: action.altText } : item,
      );
    case "set-status":
      return items.map((item) =>
        item.id === action.id ? { ...item, status: action.status } : item,
      );
    case "queue-failed":
      return items.map((item) =>
        item.status.kind === "error"
          ? { ...item, status: { kind: "queued" } }
          : item,
      );
    case "clear":
      return [];
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

export function getUploadErrorMessage(
  error: unknown,
  fallback = "Upload failed",
): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = error.data;
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return data.message;
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export async function runUploadPool<T, R>({
  items,
  worker,
  concurrency,
  shouldContinue = () => true,
}: {
  items: readonly T[];
  worker: (item: T) => Promise<R>;
  concurrency: number;
  shouldContinue?: () => boolean;
}): Promise<R[]> {
  let cursor = 0;

  async function runWorker(): Promise<Array<[number, R]>> {
    const completed: Array<[number, R]> = [];
    while (shouldContinue()) {
      const index = cursor;
      if (index >= items.length) break;
      cursor += 1;
      const item = items[index];
      if (item === undefined) break;
      completed.push([index, await worker(item)]);
    }
    return completed;
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  const completed = await Promise.all(
    Array.from({ length: workerCount }, () => runWorker()),
  );

  return completed
    .flat()
    .sort(([left], [right]) => left - right)
    .map(([, result]) => result);
}
