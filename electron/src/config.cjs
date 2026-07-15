"use strict";

// Shared constants for the desktop shell.
module.exports = {
  DEV_PORTS: [3000, 3001, 3002],
  PROD_URL: "https://wryte.xyz",
  REPO_URL: "https://github.com/rafay99-epic/wryte.xyz",
  MAX_LOAD_RETRIES: 5,
  UPDATE_CHECK_INTERVAL_MS: 6 * 60 * 60 * 1000, // 6h
  // Kill macOS elastic overscroll; give momentum scrolling.
  SCROLL_CSS: `
  html, body { overscroll-behavior: none; }
  * { -webkit-overflow-scrolling: touch; }
`,
};
