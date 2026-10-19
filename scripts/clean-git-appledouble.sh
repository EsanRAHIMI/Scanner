#!/usr/bin/env bash
# macOS on FAT32/exFAT stores xattrs as AppleDouble files (._*).
# Git then loads .git/objects/pack/._pack-*.idx as a pack index and errors
# with "non-monotonic index". Strip the xattrs and delete the sidecars.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIT="$ROOT/.git"
[[ -d "$GIT" ]] || exit 0

export COPYFILE_DISABLE=1

if command -v xattr >/dev/null 2>&1; then
  if [[ -d "$GIT/objects/pack" ]]; then
    xattr -cr "$GIT/objects/pack" 2>/dev/null || true
  fi
fi

find "$GIT" -name '._*' -delete 2>/dev/null || true
