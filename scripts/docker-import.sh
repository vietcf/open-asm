#!/usr/bin/env bash
# Load an archive made by scripts/docker-export.sh into Docker on a server
# without registry / Internet access. It only loads the images: nothing is
# started, stopped or changed.
#
#   scripts/docker-import.sh [FILE | DIR]
#     FILE    the archive to load
#     DIR     load the newest openasm_<version>_<time>.tar.gz in DIR
#             (default: the current directory; newest = highest version, then latest time)
#
# The .sha256 written by the export is checked when it is next to the archive.
set -euo pipefail

TARGET="$(pwd)"

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit "${1:-0}"; }
die() { echo "ERROR: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help) usage ;;
    -*) echo "Unknown option: $1" >&2; usage 2 ;;
    *) TARGET="$1"; shift ;;
  esac
done

if [ -d "$TARGET" ]; then
  FILE="$(ls -1 "$TARGET"/openasm_*.tar.gz 2>/dev/null | sort -V | tail -1 || true)"
  [ -n "$FILE" ] || die "no openasm_*.tar.gz in $TARGET"
else
  FILE="$TARGET"
  [ -f "$FILE" ] || die "$FILE not found"
fi
FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
echo "== Archive: $FILE ($(du -h "$FILE" | cut -f1))"

if [ -f "$FILE.sha256" ]; then
  (cd "$(dirname "$FILE")" && sha256sum -c --quiet "$(basename "$FILE").sha256") || die "checksum mismatch: the archive is damaged or incomplete"
  echo "== Checksum OK"
else
  echo "WARNING: no $(basename "$FILE").sha256 next to the archive, integrity not checked"
fi

# docker, or sudo docker when the current user cannot reach the daemon
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1 || die "cannot reach the Docker daemon"
  DOCKER=(sudo docker)
fi

echo "== Loading images"
gunzip -c "$FILE" | "${DOCKER[@]}" load
echo "Done. Nothing was started."
