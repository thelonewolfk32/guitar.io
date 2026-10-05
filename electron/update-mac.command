#!/bin/bash
set -euo pipefail
stage="$(cd -- "$(dirname "$0")" && pwd -P)"
source "$stage/plan.sh"
[[ "$STAGE" == "$stage" && "$NEW_APP" == "$stage/"* && "$TARGET" == *.app && ! -L "$TARGET" ]]
incoming="$(dirname "$TARGET")/.Guitar.io-update-$TOKEN.app"
backup="$(dirname "$TARGET")/.Guitar.io-rollback-$TOKEN.app"
renamed=0
fail() {
  if [[ "$renamed" == 1 && -d "$backup" ]]; then
    [[ ! -e "$TARGET" ]] || /bin/mv "$TARGET" "$stage/failed.app"
    /bin/mv "$backup" "$TARGET"
    [[ "$RESTART" != 1 ]] || /usr/bin/open "$TARGET"
  fi
  if [[ "$incoming" == "$(dirname "$TARGET")/.Guitar.io-update-$TOKEN.app" ]]; then /bin/rm -rf "$incoming"; fi
  printf '{"status":"failed","token":"%s","message":"Mac update could not finish. Check app folder permissions and try again."}' "$TOKEN" > "$stage/handshake.json"
  printf '{"status":"failed","version":"%s","message":"Mac update could not finish. Check app folder permissions and try again."}' "$VERSION" > "$PROFILE/update-result.json"
}
trap fail ERR
[[ ! -e "$incoming" && ! -e "$backup" ]]
/usr/bin/ditto "$NEW_APP" "$incoming"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$incoming/Contents/Info.plist")" == io.guitario.desktop ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$incoming/Contents/Info.plist")" == "$VERSION" ]]
# Apply the existing local preparation to this update only.
/usr/bin/xattr -dr com.apple.quarantine "$incoming" 2>/dev/null || true
/usr/bin/codesign --force --deep --sign - --entitlements "$stage/entitlements.plist" "$incoming"
/usr/bin/codesign --verify --deep --strict "$incoming"
printf '{"status":"ready","token":"%s"}' "$TOKEN" > "$stage/handshake.json"
for ((n=0;n<120;n++)); do
  if ! /bin/kill -0 "$PARENT_PID" 2>/dev/null; then break; fi
  /bin/sleep 1
done
if /bin/kill -0 "$PARENT_PID" 2>/dev/null; then fail; exit 1; fi
/bin/mv "$TARGET" "$backup"; renamed=1
/bin/mv "$incoming" "$TARGET"
[[ "$RESTART" != 1 ]] || /usr/bin/open "$TARGET"
printf '{"status":"installed","version":"%s","rollbackToken":"%s"}' "$VERSION" "$TOKEN" > "$PROFILE/update-result.json"
# Verified sibling app and staging paths only; preserve the old app for rollback.
if [[ "$stage" == "$PROFILE/app-updates/download-"* ]]; then /bin/rm -rf "$stage" || true; fi
