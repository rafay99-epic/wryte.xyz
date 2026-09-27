const { execFileSync } = require("node:child_process");
const path = require("node:path");

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
