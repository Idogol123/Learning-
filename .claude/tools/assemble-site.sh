#!/usr/bin/env bash
# Assemble the deployable Pages site into $1 (default: _site).
#
# Single source of truth for the site layout: the hub (landing) at the root and
# every other top-level directory that has an index.html served at its own path.
# Both the Deploy workflow (deploy-pages.yml) AND the CI gate (ci.yml) call this,
# so a broken assemble step is caught on a branch/PR instead of on the live
# `main` deploy. Run from the repo root.
set -euo pipefail

OUT="${1:-_site}"
rm -rf "$OUT"
mkdir -p "$OUT"

# --- Hub (landing) is served at the site root ---
cp landing/index.html "$OUT/index.html"
# Stamp the landing page with the last-change time (Israel time) so visitors can
# tell whether they're on the latest deployed version. Falls back gracefully if
# git history isn't available (e.g. a shallow/odd checkout).
BUILD_TIME=$(TZ='Asia/Jerusalem' git log -1 --format=%cd --date=format-local:'%d/%m/%Y %H:%M' 2>/dev/null || true)
if [ -n "$BUILD_TIME" ]; then
  sed -i "s|__BUILD_TIME__|${BUILD_TIME}|" "$OUT/index.html"
fi
cp landing/manifest.webmanifest landing/sw.js "$OUT/"
cp landing/icon-192.png landing/icon-512.png landing/icon-maskable-512.png landing/apple-touch-icon.png "$OUT/"

# --- Tools: every other top-level dir that has an index.html ---
for d in */; do
  d="${d%/}"
  case "$d" in
    landing|node_modules|"$OUT") continue ;;  # skip the hub, deps, and our own output dir
  esac
  if [ -f "$d/index.html" ]; then
    echo "Deploying tool: $d"
    cp -r "$d" "$OUT/$d"
  fi
done

echo "Assembled site into '$OUT':"
ls -la "$OUT"
