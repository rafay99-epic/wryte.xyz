const isDev = process.env.WRYTE_FLAVOR === "dev";

/** @type {import('electron-builder').Configuration} */
const config = {
  appId: isDev ? "xyz.wryte.desktop.dev" : "xyz.wryte.desktop",
  productName: isDev ? "Wryte Dev" : "Wryte",
  files: ["electron/**", "public/wryte-icon.png"],
  npmRebuild: false,
  afterPack: "electron/afterpack-sign.cjs",
  directories: {
    buildResources: "build",
    output: isDev ? "dist-dev" : "dist",
  },
  mac: {
    target: ["dmg", "zip"],
    category: "public.app-category.productivity",
    identity: null,
  },
  dmg: {
    artifactName: `${isDev ? "Wryte-Dev" : "Wryte"}.dmg`,
  },
  win: {
    target: "nsis",
  },
  linux: {
    target: "AppImage",
  },
  publish: isDev
    ? null
    : {
        provider: "github",
        owner: "rafay99-epic",
        repo: "wryte.xyz",
        releaseType: "draft",
      },
};

module.exports = config;
