"use strict";

const isDevFlavor = process.env.WRYTE_FLAVOR === "dev";

// Shared constants for the desktop shell.
module.exports = {
  isDevFlavor,
  APP_NAME: isDevFlavor ? "Wryte Dev" : "Wryte",
  APP_ID: isDevFlavor ? "xyz.wryte.desktop.dev" : "xyz.wryte.desktop",
  LOG_DIR: isDevFlavor ? ".wryteDev" : ".wryte",
  DEV_PORTS: [3000, 3001, 3002],
  PROD_URL: "https://wryte.xyz",
  REPO_URL: "https://github.com/rafay99-epic/wryte.xyz",
  MAX_LOAD_RETRIES: 5,
  UPDATE_CHECK_INTERVAL_MS: 6 * 60 * 60 * 1000, // 6h
  // Connectivity check URL (returns 204 on reachable networks).
  CONNECTIVITY_CHECK_HOST: "clients3.google.com",
  CONNECTIVITY_CHECK_PATH: "/generate_204",
  CONNECTIVITY_CHECK_INTERVAL_MS: 30 * 1000,
  // Kill macOS elastic overscroll; give momentum scrolling.
  SCROLL_CSS: `
  html, body { overscroll-behavior: none; }
`,
};
