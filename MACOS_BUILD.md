# Guitar.io v1.5.0 — Apple Silicon Mac

Requires an Apple Silicon Mac and macOS 13 Ventura or later, as specified by the included Electron 44.4.5 runtime. The app contains the same frontend/GP/MIDI code as the verified Windows v1.5.0 package. No Node installation or Windows emulator is needed to run it.

1. Transfer `Guitar-io-1.5.0-macOS-arm64.zip` to your Mac and double-click the ZIP in Finder. Extract it on the Mac so framework symbolic links and executable permissions are retained.
2. Inside the extracted folder, run **Prepare and open Guitar.io.command**. Keep it next to Guitar.io.app and local-signing-entitlements.plist. It verifies the packaged app data, removes quarantine only from this app bundle, ad-hoc signs it for local use and opens it. No administrator access is requested.
3. If macOS blocks the command, open Terminal, type `/bin/bash ` (including the trailing space), drag the command file into Terminal, and press Return. Review the command before running it if desired. This does not disable Gatekeeper or change global security settings.
4. After closing the app, drag **Guitar.io.app** to Applications. Future launches can open it directly.

This is a local development build, without an Apple Developer ID signature or notarization. Signing and native playback cannot be verified on the Windows build host; the included setup command must finish on your MacBook. The ZIP has been checked for arm64 Mach-O executables, bundle/helper names, executable modes, framework links, checksums and matching app data. A broadly distributed release should be signed/notarized on macOS using an Apple Developer certificate.

To transfer your Windows library, export a full backup from Help → Backups on Windows (include attached audio/artwork), copy the backup to the Mac and restore it from Help → Backups there. You can also pair the Mac and PC from Device sync using their six-digit discovery code and matching verification digits. Keep both devices awake on the same Wi-Fi/Ethernet LAN. Mac library data is stored separately in `~/Library/Application Support/Guitar.io`.

On your first Mac run, check opening a GP file, MIDI/Stories sound and tuning, MIDI/fully synced YouTube section speeds, whole-song audio speed, direct Songsterr import, Splicer/Undo merge, fine BPM/percentage speeds, aligned Splicer selection, save/reopen and a backup round trip.

## Reproduce from the development source

`scripts/package-mac.py` builds directly from an official Electron arm64 runtime ZIP and its official SHASUMS256.txt, preserving Unix ZIP modes and symbolic links without extracting them on Windows. It takes the packaged Windows app.asar by default; use `--asar` to supply the same-version archive from another package. It refuses to replace an existing Mac archive.

Download `electron-v44.4.5-darwin-arm64.zip` and `SHASUMS256.txt` from the official Electron v44.4.5 release into `release/mac-runtime`, then run `python scripts/package-mac.py` after packaging Windows. `release` is excluded from the Source ZIP. The script verifies the runtime checksum before packaging and checks the output ZIP. Public notarized releases should use standard Electron packaging/signing tooling on macOS.

References: [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [Electron code signing](https://www.electronjs.org/docs/latest/tutorial/code-signing).

## Later direct-open distribution

The app cannot sign itself before Gatekeeper validates it. Once an Apple Developer membership is available, build on macOS with electron-builder and a Developer ID Application certificate, then notarize and staple the app before distributing it. The mac configuration includes arm64, hardened runtime and entitlements. For the current testing package, retain the prepare command and entitlements beside the app; no developer membership is required for its local ad-hoc signing.


## Updates during testing

After the initial preparation, use Help (?) → version number → Check for updates. The updater verifies the download, validates and normalises signing entitlements, signs and verifies the new bundle, then closes, replaces and reopens Guitar.io. It runs without a Terminal window. If preparation fails, Guitar.io stays open and shows the failing step; details are saved in `~/Library/Application Support/Guitar.io/update-install.log`. Interactive Gatekeeper/relaunch still needs a MacBook check. Standard Developer ID signing and notarization can replace this local preparation later.

If your older V1.4.4/V1.4.41 updater fails with `AMFIUnserializeXML`, quit Guitar.io and manually prepare this V1.4.42 ZIP once, then replace your existing app with the prepared Guitar.io.app. Keep your Application Support folder; it holds the library. The old updater cannot fix its own signing command by downloading a new app. Once this release is installed, future updates use the corrected background installer.
