#!/usr/bin/env bash
# Build the app image and export it, together with the other images
# docker-compose.yml uses (postgres, nginx, pgadmin), into one archive for a
# server without registry / Internet access. Import it there with
# scripts/docker-import.sh. Nothing is started or stopped.
#
#   scripts/docker-export.sh [options]
#     -o, --output DIR    where to write the archive (default: current directory)
#     --app-only          export only the app image (the server already has the others)
#     --no-build          export the existing app image, do not build it
#     --platform P        target platform of the server (default: linux/amd64)
#
# Output: DIR/openasm_<version>_<YYYYmmdd-HHMMSS>.tar.gz and a .sha256 next to it.
# The version is the app image tag in docker-compose.yml (same as package.json).
set -euo pipefail

OUT_DIR="$(pwd)"
APP_ONLY=0
BUILD=1
PLATFORM="linux/amd64"

usage() { awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"; exit "${1:-0}"; }
die() { echo "ERROR: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    -o|--output) OUT_DIR="${2:?missing directory}"; shift 2 ;;
    --app-only) APP_ONLY=1; shift ;;
    --no-build) BUILD=0; shift ;;
    --platform) PLATFORM="${2:?missing platform}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1" >&2; usage 2 ;;
  esac
done

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
cd "$(dirname "$0")/.."   # project root: docker-compose.yml, Dockerfile

# docker, or sudo docker when the current user cannot reach the daemon
DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1 || die "cannot reach the Docker daemon"
  DOCKER=(sudo docker)
fi

mapfile -t IMAGES < <("${DOCKER[@]}" compose config --images | tr -d '\r' | sort -u)
APP_IMAGE="$(printf '%s\n' "${IMAGES[@]}" | grep '^openasm_app:' || true)"
[ -n "$APP_IMAGE" ] || die "no openasm_app image in docker-compose.yml"
VERSION="${APP_IMAGE#openasm_app:}"
PKG_VERSION="$(sed -n 's/^ *"version": *"\([^"]*\)".*/\1/p' package.json | head -1)"
[ "$VERSION" = "$PKG_VERSION" ] || echo "WARNING: docker-compose.yml tag $VERSION differs from package.json $PKG_VERSION"

echo "== Open ASM $VERSION for $PLATFORM ($(git describe --tags --always --dirty 2>/dev/null || echo 'no git'))"

if [ "$BUILD" = 1 ]; then
  echo "== Building $APP_IMAGE"
  "${DOCKER[@]}" build --platform "$PLATFORM" -t "$APP_IMAGE" .
fi
"${DOCKER[@]}" image inspect "$APP_IMAGE" >/dev/null 2>&1 || die "$APP_IMAGE not found (drop --no-build)"

if [ "$APP_ONLY" = 1 ]; then
  IMAGES=("$APP_IMAGE")
else
  # Third-party images: pull them for the server's platform when missing or built for another one
  for img in "${IMAGES[@]}"; do
    [ "$img" = "$APP_IMAGE" ] && continue
    have="$("${DOCKER[@]}" image inspect -f '{{.Os}}/{{.Architecture}}' "$img" 2>/dev/null || true)"
    if [ "$have" != "$PLATFORM" ]; then
      echo "== Pulling $img ($PLATFORM)"
      "${DOCKER[@]}" pull --platform "$PLATFORM" "$img"
    fi
  done
fi

for img in "${IMAGES[@]}"; do
  arch="$("${DOCKER[@]}" image inspect -f '{{.Os}}/{{.Architecture}}' "$img")"
  [ "$arch" = "$PLATFORM" ] || die "$img is $arch, not $PLATFORM"
done

FILE="openasm_${VERSION}_$(date +%Y%m%d-%H%M%S).tar.gz"
echo "== Saving ${IMAGES[*]}"
"${DOCKER[@]}" save "${IMAGES[@]}" | gzip > "$OUT_DIR/$FILE.part"
mv "$OUT_DIR/$FILE.part" "$OUT_DIR/$FILE"
(cd "$OUT_DIR" && sha256sum "$FILE" > "$FILE.sha256")

echo
echo "Done: $OUT_DIR/$FILE ($(du -h "$OUT_DIR/$FILE" | cut -f1))"
echo "Copy it with its .sha256 to the server, then in that directory:"
echo "  scripts/docker-import.sh            # load the newest archive (starts nothing)"
