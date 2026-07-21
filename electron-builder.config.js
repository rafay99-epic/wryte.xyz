const isDev = process.env.WRYTE_FLAVOR === "dev";

const publishConfig = isDev
  ? undefined
  : {
      provider: "github",
      owner: "rafay99-epic",
      repo: "wryte.xyz",
      releaseType: "draft",
    };

// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder variable syntax
const _ext = "${ext}";
const winArtifact = `Wryte-Setup.${_ext}`;
const linuxArtifact = `Wryte.${_ext}`;

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
    publish: publishConfig,
  },
  dmg: {
    artifactName: `${isDev ? "Wryte-Dev" : "Wryte"}.dmg`,
  },
  win: {
    target: "nsis",
    artifactName: winArtifact,
    publish: publishConfig,
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  linux: {
    target: ["AppImage", "snap"],
    category: "Office",
    executableName: "wryte",
    artifactName: linuxArtifact,
    publish: publishConfig,
  },
  snap: {
    publish: publishConfig,
  },
};

module.exports = config;
