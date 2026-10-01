export function appUrl(path: string): string {
  const base = process.env["PUBLIC_APP_URL"]?.trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
