#!/bin/bash
# Local development setup, run on the destination Apple Silicon Mac.
set -euo pipefail
package_dir="$(cd -- "$(dirname "$0")" && pwd -P)"
app_path="$package_dir/Guitar.io.app"
expected_asar="__ASAR_SHA256__"
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Run this command on your MacBook.'
  exit 1
fi
if [[ ! -d "$app_path" || -L "$app_path" ]]; then
  echo 'Keep this command next to the included Guitar.io.app.'
  exit 1
fi
if [[ "$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Contents/Info.plist")" != io.guitario.desktop ]]; then
  echo 'The app bundle identifier did not match Guitar.io.'
  exit 1
fi
actual_asar="$(/usr/bin/shasum -a 256 "$app_path/Contents/Resources/app.asar" | /usr/bin/awk '{print $1}')"
if [[ "$actual_asar" != "$expected_asar" ]]; then
  echo 'The included app data did not match the packaged build. Extract the ZIP again.'
  exit 1
fi
echo 'Preparing Guitar.io for local use on this Mac…'
# Scope quarantine removal to this verified bundle; never change system policy.
/usr/bin/xattr -dr com.apple.quarantine "$app_path" 2>/dev/null || true
/usr/bin/codesign --force --deep --sign - --entitlements "$package_dir/local-signing-entitlements.plist" "$app_path"
/usr/bin/codesign --verify --deep --strict "$app_path"
echo 'Prepared. You can move Guitar.io.app to Applications after closing it.'
/usr/bin/open "$app_path"
