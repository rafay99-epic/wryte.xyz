#!/usr/bin/env bash
#
# Bump a Homebrew cask in the rafay99-epic/homebrew-apps tap to a freshly
# published release. Called from this repo's release workflows right after the
# GitHub release is created, so the tap never goes stale and nobody hand-edits a
# sha256 again.
#
# Both the stable and nightly casks are version-pinned (version "…" / sha256
# "…"), so each release rewrites those two lines: this computes the sha256 of the
# DMG we just shipped and pushes the change straight to the tap's `main` (which
# isn't branch-protected). Sibling repos releasing at the same time touch
# different cask files, so the only contention is a non-fast-forward push — the
# retry loop re-syncs and pushes again.
#
# Usage:  VERSION=0.13 CASK=porter TAP_TOKEN=… bump-cask.sh /abs/path/App.dmg
#
# Requires: git, shasum. TAP_TOKEN is a fine-grained PAT with Contents: Read &
# Write on rafay99-epic/homebrew-apps. Runs on a macOS runner (BSD sed).

set -euo pipefail

VERSION="${VERSION:?VERSION env var required}"
CASK="${CASK:?CASK env var required (cask name without .rb, e.g. porter)}"
DMG="${1:?path to the .dmg required}"
: "${TAP_TOKEN:?TAP_TOKEN env var required}"

SHA=$(shasum -a 256 "$DMG" | awk '{print $1}')
echo "Bumping ${CASK} cask → ${VERSION}  (${SHA})"

REMOTE="https://x-access-token:${TAP_TOKEN}@github.com/rafay99-epic/homebrew-apps.git"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

git clone --quiet "$REMOTE" "$WORK"
cd "$WORK"

CASK_FILE="Casks/${CASK}.rb"
[ -f "$CASK_FILE" ] || { echo "::error::${CASK_FILE} not found in tap"; exit 1; }

# Rewrite only the two pinned lines in the top stanza (anchored to a 2-space
# indent so url/livecheck/etc. are never touched). BSD sed (macOS runner).
sed -i '' -E \
  -e "s|^  version \"[^\"]*\"|  version \"${VERSION}\"|" \
  -e "s|^  sha256 \"[0-9a-f]*\"|  sha256 \"${SHA}\"|" \
  "$CASK_FILE"

if git diff --quiet -- "$CASK_FILE"; then
  echo "::notice::${CASK} cask already at ${VERSION} (${SHA}) — nothing to push."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add "$CASK_FILE"
git commit --quiet -m "${CASK} ${VERSION}"

# Push to the tap's main, re-syncing if a sibling repo pushed first.
for attempt in 1 2 3 4 5; do
  if git push --quiet "$REMOTE" HEAD:main 2>/dev/null; then
    echo "::notice::Pushed ${CASK} ${VERSION} to the homebrew-apps tap."
    exit 0
  fi
  echo "Push rejected (attempt ${attempt}/5) — re-syncing with tap main…"
  git pull --rebase --quiet "$REMOTE" main || { git rebase --abort 2>/dev/null || true; }
done

echo "::error::Could not push ${CASK} ${VERSION} to the tap after 5 attempts."
exit 1
