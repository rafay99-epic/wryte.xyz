const { execFileSync } = require("node:child_process");
const path = require("node:path");

// electron-builder renames the bundle, swaps the icon and Info.plist, which
// invalidates Electron's built-in signature. On Apple Silicon an invalid
// signature reads as "damaged and can't be opened". With no Apple Developer ID
// we can't notarize, so ad-hoc re-sign the finished bundle (codesign -s -) —
// the same trick the Swift apps use. Gatekeeper still quarantines a *download*,
// which the Homebrew cask's postflight xattr strip clears.
exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execFileSync(
    "codesign",
    ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath],
    { stdio: "inherit" },
  );
};
