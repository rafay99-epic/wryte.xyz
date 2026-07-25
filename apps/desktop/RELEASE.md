# Desktop release & the TAP_TOKEN

How the Electron desktop app is built, released, and distributed via Homebrew —
and the token gotcha that broke a release, so it doesn't happen again.

## Release flow (tag `vX.Y.Z` → published + on Homebrew)

`.github/workflows/desktop-release.yml`:

1. **detect** — diffs `electron/`, `build/`, and the workflow vs the previous
   tag. No desktop changes → skip the paid 3-OS matrix.
2. **prepare** — creates ONE draft GitHub Release for the tag. (GitHub's
   get-release-by-tag skips drafts, so without this each matrix job would
   create its own duplicate draft.)
3. **build** ×3 (macOS/Windows/Linux) — electron-builder uploads
   `Wryte.dmg` + `Wryte-*-mac.zip`, `Wryte-Setup-*.exe`, `Wryte-*.AppImage`,
   and the `latest*.yml` update manifests to that **draft**. Draft = mutable, so
   uploads work under GitHub **immutable releases** (a published release rejects
   asset uploads with `422 Cannot upload assets to an immutable release`).
4. **finalize** — publishes the draft as **latest** (freezing it), then bumps
   the Homebrew cask (`.github/scripts/bump-cask.sh`) to the new version + the
   dmg's real sha256, pushing to `rafay99-epic/homebrew-apps`.

macOS is **ad-hoc signed** (afterPack hook, no Apple account). The cask's
`postflight` strips the download quarantine so `brew install` opens it cleanly
without notarization.

Cut a release:

```sh
git tag v1.2.3 && git push origin v1.2.3
```

Note: GitHub immutable releases also make the **tag** immutable — a tag name
used once cannot be deleted and reused. If a release fails, bump to the next
version; don't try to re-push the same tag.

## The TAP_TOKEN problem

The **finalize** step pushes the updated cask to the `homebrew-apps` tap using
the `TAP_TOKEN` repo secret. That token MUST be a fine-grained PAT with
**Contents: Read & Write on `rafay99-epic/homebrew-apps`**.

**What broke:** TAP_TOKEN was first set to the **env-connect / envpilot** PAT.
Fine-grained PATs are scoped per-repo, and that one has **no access to
`homebrew-apps`** — so the cask push was rejected 5×
(`Could not push wryte X to the tap after 5 attempts`). The build, release, and
assets were all fine; only the cask bump failed, leaving the tap pinned to a
stale version + placeholder sha (a broken `brew install`).

**The correct token:** the **shared Homebrew tap PAT** — the same one
`Vitals` / `Crisp` / `porter` use for their TAP_TOKEN. Identity:

| field | value |
|-------|-------|
| type | GitHub fine-grained PAT |
| fingerprint | `github_pat_11A…EqpW` (len 93) |
| required scope | `rafay99-epic/homebrew-apps` → Contents: R/W |
| where it lives | the same secret across all tap-consuming repos |

The raw value is **not** stored here — this is a public repo. Pull it from your
password manager or a session where it was set, and verify before use:

```sh
# should print: true
GH_TOKEN='github_pat_…' gh api repos/rafay99-epic/homebrew-apps --jq .permissions.push

# set it on wryte.xyz (reads value from stdin — never in argv/history)
printf '%s' 'github_pat_…' | gh secret set TAP_TOKEN -R rafay99-epic/wryte.xyz
```

Do **not** use the env-connect/envpilot PAT here — wrong scope. If you ever
rotate the shared tap PAT, every tap-consuming repo's TAP_TOKEN must be updated.
