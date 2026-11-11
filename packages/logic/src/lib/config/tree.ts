export type ConfigFileEntry = { path: string; size: number };

export type ConfigFolder = {
  path: string;
  name: string;
  depth: number;
  fileCount: number;
  totalCount: number;
};

export function folderOf(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

export function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function relativeTo(root: string, path: string): string {
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

export function listConfigFolders(
  files: readonly ConfigFileEntry[],
): ConfigFolder[] {
  const direct = new Map<string, number>();
  const total = new Map<string, number>();
  for (const file of files) {
    const folder = folderOf(file.path);
    if (folder === "") continue;
    direct.set(folder, (direct.get(folder) ?? 0) + 1);
    const segments = folder.split("/");
    for (let i = 1; i <= segments.length; i++) {
      const ancestor = segments.slice(0, i).join("/");
      total.set(ancestor, (total.get(ancestor) ?? 0) + 1);
    }
  }
  return [...total.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, totalCount]) => ({
      path,
      name: fileName(path),
      depth: path.split("/").length - 1,
      fileCount: direct.get(path) ?? 0,
      totalCount,
    }));
}

export function filesUnder(
  files: readonly ConfigFileEntry[],
  folder: string,
): ConfigFileEntry[] {
  return files.filter((file) => file.path.startsWith(`${folder}/`));
}
