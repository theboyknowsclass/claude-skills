#!/usr/bin/env bash
# Installs or updates SolidCraft on macOS or Linux from the latest GitHub release.
# Verifies every download against the release's SHA256SUMS.txt.
#
#   solidcraft-update.sh [--install-dir DIR] [--check-only] [--app]
#
#   --install-dir  where solidcraft-cli goes (default ~/.local/share/solidcraft, linked into ~/.local/bin)
#   --check-only   only report whether an update exists
#   --app          macOS: also install the GUI app (SolidCraft.app) into ~/Applications.
#                  Needed only for live mode (solidcraft-live); headless MCP needs just the CLI.
#
# Exit codes: 0 = installed / updated / up to date, 1 = error.
set -euo pipefail

INSTALL_DIR="$HOME/.local/share/solidcraft"
CHECK_ONLY=0
WITH_APP=0
while [ $# -gt 0 ]; do
  case "$1" in
    --install-dir) INSTALL_DIR="$2"; shift 2 ;;
    --check-only) CHECK_ONLY=1; shift ;;
    --app) WITH_APP=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

log() { echo "$(date +%Y-%m-%dT%H:%M:%S)  $*"; }
die() { log "ERROR: $*"; exit 1; }
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | awk '{print tolower($1)}'; }
need() { command -v "$1" >/dev/null || die "$1 is required"; }
need curl; need tar; need awk

os="$(uname -s)"; arch="$(uname -m)"
case "$os" in
  Darwin) cli_asset() { echo "solidcraft-cli-$1-macos-universal.zip"; } ;;
  Linux)
    case "$arch" in x86_64|amd64) a=x86_64 ;; aarch64|arm64) a=aarch64 ;; *) die "unsupported arch $arch" ;; esac
    cli_asset() { echo "solidcraft-$1-linux-$a.tar.gz"; } ;;
  *) die "unsupported OS $os (use solidcraft-update.ps1 on Windows)" ;;
esac

cli="$INSTALL_DIR/solidcraft-cli"
cur="0.0.0"
[ -x "$cli" ] && cur="$("$cli" --version | awk '{print $NF}')"

api="https://api.github.com/repos/tangency-labs/solidcraft/releases/latest"
json="$(curl -fsSL -H 'User-Agent: solidcraft-updater' "$api")" || die "cannot reach GitHub"
new="$(printf '%s' "$json" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"; new="${new#v}"
[ -n "$new" ] || die "no tag_name in latest release"

newer="$(printf '%s\n%s\n' "$cur" "$new" | sort -V | tail -1)"
if [ "$cur" = "$new" ] || [ "$newer" = "$cur" ]; then log "up to date ($cur)"; exit 0; fi
log "update available: $cur -> $new"
[ "$CHECK_ONLY" = 1 ] && exit 0

url_of() {  # exact asset name -> download URL (works on compact or pretty JSON)
  printf '%s' "$json" | grep -o '"browser_download_url": *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/' \
    | awk -v n="$1" '{ k = split($0, p, "/"); if (p[k] == n) { print; exit } }'
}
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/SHA256SUMS.txt" "$(url_of SHA256SUMS.txt)" || die "no SHA256SUMS.txt"

fetch() {  # fetch <asset name>: download and verify
  local name="$1" url expected actual
  url="$(url_of "$name")"; [ -n "$url" ] || die "release $new has no $name"
  curl -fsSL -o "$tmp/$name" "$url"
  expected="$(awk -v n="$name" '$NF==n || $NF==("*" n) {print tolower($1); exit}' "$tmp/SHA256SUMS.txt")"
  [ -n "$expected" ] || die "no checksum for $name"
  actual="$(sha256 "$tmp/$name")"
  [ "$expected" = "$actual" ] || die "checksum mismatch for $name"
  log "checksum ok: $name"
}

asset="$(cli_asset "$new")"
fetch "$asset"
mkdir -p "$tmp/x"
case "$asset" in
  *.zip) need unzip; unzip -q "$tmp/$asset" -d "$tmp/x" ;;
  *) tar -xzf "$tmp/$asset" -C "$tmp/x" ;;
esac
src="$(find "$tmp/x" -type f -name solidcraft-cli | head -1)"
[ -n "$src" ] || die "solidcraft-cli not found in $asset"

mkdir -p "$INSTALL_DIR" "$HOME/.local/bin"
cp -R "$(dirname "$src")"/. "$INSTALL_DIR"/
chmod +x "$INSTALL_DIR"/solidcraft* 2>/dev/null || true
[ "$os" = Darwin ] && xattr -dr com.apple.quarantine "$INSTALL_DIR" 2>/dev/null || true
ln -sf "$cli" "$HOME/.local/bin/solidcraft-cli"
log "installed solidcraft-cli $new in $INSTALL_DIR (linked in ~/.local/bin)"

if [ "$WITH_APP" = 1 ] && [ "$os" = Darwin ]; then
  dmg="solidcraft-$new-macos-universal.dmg"
  fetch "$dmg"
  mnt="$tmp/mnt"; mkdir -p "$mnt"
  hdiutil attach -nobrowse -quiet -mountpoint "$mnt" "$tmp/$dmg"
  app="$(find "$mnt" -maxdepth 1 -name '*.app' | head -1)"
  [ -n "$app" ] || { hdiutil detach -quiet "$mnt"; die "no .app in $dmg"; }
  mkdir -p "$HOME/Applications"
  rm -rf "$HOME/Applications/$(basename "$app")"
  cp -R "$app" "$HOME/Applications/"
  hdiutil detach -quiet "$mnt"
  xattr -dr com.apple.quarantine "$HOME/Applications/$(basename "$app")" 2>/dev/null || true
  log "installed $(basename "$app") in ~/Applications"
fi
log "restart MCP clients to load the new server"
