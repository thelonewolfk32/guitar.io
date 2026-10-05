#!/bin/bash
set -euo pipefail
stage="$(cd -- "$(dirname "$0")" && pwd -P)"
source "$stage/plan.sh"
# macOS aliases /var to /private/var. Compare physical paths consistently,
# including temporary profiles, rather than skipping cleanup on an alias.
if [[ "$TARGET" != *.app || -L "$TARGET" ]]; then exit 1; fi
STAGE="$(cd -- "$STAGE" && pwd -P)"
PROFILE="$(cd -- "$PROFILE" && pwd -P)"
NEW_APP="$(cd -- "$NEW_APP" && pwd -P)"
TARGET="$(cd -- "$TARGET" && pwd -P)"
if [[ "$STAGE" != "$stage" || "$NEW_APP" != "$stage/"* || "$TARGET" != *.app || ! "$TOKEN" =~ ^[a-f0-9-]{36}$ ]]; then exit 1; fi
incoming="$(dirname "$TARGET")/.Guitar.io-update-$TOKEN.app"
backup="$(dirname "$TARGET")/.Guitar.io-rollback-$TOKEN.app"
canonical="$stage/canonical-entitlements.plist"
renamed=0
phase=preparation
fail() {
  local result=$?
  trap - ERR
  set +e
  case "$phase" in
    entitlements) message='Mac signing permissions could not be read. Download a fresh Mac package.' ;;
    signing) message='macOS could not sign the update.' ;;
    verification) message='macOS could not verify the signed update.' ;;
    waiting) message='Guitar.io did not close in time. Close it and retry the update.' ;;
    replacement) message='Mac update could not replace the app. Check app folder permissions.' ;;
    restart) message='macOS could not reopen the update. The previous app was restored.' ;;
    *) message='Mac update preparation failed.' ;;
  esac
  message="$message See update-install.log for details."
  if [[ "$renamed" == 1 && -d "$backup" ]]; then
    [[ ! -e "$TARGET" ]] || /bin/mv "$TARGET" "$stage/failed.app"
    /bin/mv "$backup" "$TARGET"
    [[ "$RESTART" != 1 ]] || /usr/bin/open "$TARGET"
  fi
  if [[ "$incoming" == "$(dirname "$TARGET")/.Guitar.io-update-$TOKEN.app" ]]; then /bin/rm -rf "$incoming"; fi
  printf '\nUpdate failed during %s (exit %s). %s\n' "$phase" "$result" "$message" >&2
  printf '{"status":"failed","token":"%s","step":"%s","message":"%s"}' "$TOKEN" "$phase" "$message" > "$stage/handshake.json"
  printf '{"status":"failed","version":"%s","step":"%s","message":"%s"}' "$VERSION" "$phase" "$message" > "$PROFILE/update-result.json"
  exit 1
}
trap fail ERR
[[ ! -e "$incoming" && ! -e "$backup" ]]
/usr/bin/ditto "$NEW_APP" "$incoming"
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$incoming/Contents/Info.plist")" == io.guitario.desktop ]]
[[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$incoming/Contents/Info.plist")" == "$VERSION" ]]
# CoreFoundation can accept plist text that the stricter AMFI XML parser rejects.
# Normalise with Apple's serializer and include current DER entitlements too.
phase=entitlements
/usr/bin/plutil -lint "$stage/entitlements.plist"
/usr/bin/plutil -convert xml1 -o "$canonical" "$stage/entitlements.plist"
phase=signing
/usr/bin/xattr -dr com.apple.quarantine "$incoming" 2>/dev/null || true
/usr/bin/codesign --force --deep --sign - --generate-entitlement-der --entitlements "$canonical" "$incoming"
phase=verification
/usr/bin/codesign --verify --deep --strict "$incoming"
printf '{"status":"ready","token":"%s"}' "$TOKEN" > "$stage/handshake.json"
phase=waiting
for ((n=0;n<120;n++)); do
  if ! /bin/kill -0 "$PARENT_PID" 2>/dev/null; then break; fi
  /bin/sleep 1
done
if /bin/kill -0 "$PARENT_PID" 2>/dev/null; then false; fi
phase=replacement
/bin/mv "$TARGET" "$backup"; renamed=1
/bin/mv "$incoming" "$TARGET"
printf '{"status":"installed","version":"%s","rollbackToken":"%s"}' "$VERSION" "$TOKEN" > "$PROFILE/update-result.json"
phase=restart
[[ "$RESTART" != 1 ]] || /usr/bin/open "$TARGET"
# Verified sibling app and staging paths only; preserve the old app for rollback.
if [[ "$stage" == "$PROFILE/app-updates/download-"* ]]; then /bin/rm -rf "$stage" || true; fi
