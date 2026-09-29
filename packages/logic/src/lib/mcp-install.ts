const SERVER_NAME = "wryte";

export const CHATGPT_URL = "https://chatgpt.com/";

export function claudeCodeCommand(endpoint: string): string {
  return `claude mcp add --transport http ${SERVER_NAME} ${endpoint}`;
}

export function cursorInstallUrl(endpoint: string): string {
  const config = btoa(JSON.stringify({ url: endpoint }));
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${encodeURIComponent(config)}`;
}

export function vscodeInstallUrl(endpoint: string): string {
  const config = { name: SERVER_NAME, type: "http", url: endpoint };
  return `vscode:mcp/install?${encodeURIComponent(JSON.stringify(config))}`;
}
