# Desktop App

`apps/desktop` is a native shell around the web app, not a second
implementation. It imports nothing from `apps/web` — the web app is a URL to it.

- **Development** — probes ports 3000, 3001, 3002 and attaches to whichever dev
  server answers.
- **Production** — loads `https://wryte.xyz`.

## Layout

```
apps/desktop/
├── main.cjs                # Entry: lifecycle, IPC wiring, worker spawn
├── src/
│   ├── config.cjs          # App name, dev ports, prod URL, log dir
│   ├── logger.cjs          # Initialised first, before any other module
│   ├── window/
│   │   ├── window.cjs      # BrowserWindow creation, dev-server probing
│   │   ├── state.cjs       # Persisted window bounds
│   │   ├── preload.cjs     # Renderer bridge
│   │   ├── loading.html    # Shown while the app boots
│   │   └── offline.html    # Shown when the app is unreachable
│   ├── menu/menu.cjs       # Application menu
│   ├── tray/tray.cjs       # Menu-bar tray, hide-to-tray
│   ├── updater/            # electron-updater flow + its own window
│   ├── about/              # About window
│   └── workers/            # Connectivity + task child processes
├── assets/wryte-icon.png   # Runtime icon (tray, window, about)
├── build/icon.png          # electron-builder buildResources
└── electron-builder.js     # Packaging + publish config
```

`assets/` is the app's own copy of the icon. It does not read from
`apps/web/public/` — the packaged app has no access to another workspace's
files.

## Running it

```bash
bun run dev                 # everything, including the shell
bun run dev:desktop         # shell only, attaches to a running dev server
```

Both set `WRYTE_FLAVOR=dev`, which switches the app to `Wryte Dev`
(appId `xyz.wryte.desktop.dev`), so it installs alongside a release build
without collision.

## Packaging

```bash
bun run desktop:pack        # electron-builder --dir, unpacked
bun run desktop:dist        # dmg + zip (macOS), nsis (Windows)
```

Dev-flavour equivalents output to `dist-dev/`:

```bash
bun run --filter @wryte/desktop dev:pack
bun run --filter @wryte/desktop dev:dist
```

### What gets packaged

`electron-builder.js` ships only what the shell needs:

```js
files: ["main.cjs", "src/**", "assets/**"]
```

Production dependencies (`electron-updater`) are collected from
`apps/desktop/node_modules`. `npmRebuild` is off — there are no native modules
to rebuild.

To verify a build without installing it:

```bash
bunx asar list "apps/desktop/dist/mac-arm64/Wryte.app/Contents/Resources/app.asar"
```

Expect `main.cjs`, `src/**`, `assets/wryte-icon.png`, and
`node_modules/electron-updater`.

## Auto-update

`electron-updater` checks the GitHub releases of `rafay99-epic/wryte.xyz`. New
versions are published by CI with a patch component equal to the CI run number,
so the version can never regress and the updater always fires. Release
mechanics: [deployment.md](deployment.md#desktop--github-releases--homebrew).

Dev-flavour builds have no publish config — they never auto-update.

## Performance switches

`main.cjs` sets these before the app is ready:

- `v8-cache-options=code` — pre-compiled JS cache, faster subsequent starts
- `disable-software-rasterizer`, `enable-gpu-rasterization` — GPU path

## Logging

Initialised before any other module so crash handlers are in place from the
first tick. Logs go to `~/<LOG_DIR>` as configured in `src/config.cjs`.
