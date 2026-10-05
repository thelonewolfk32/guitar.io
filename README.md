# Guitar.io

A local guitar library and practice player for Windows and Apple Silicon Mac. Import Guitar Pro or Songsterr tabs, organise songs and guitars, track section progress, practise with MIDI or YouTube, and splice parts into a learning arrangement.

**Current version: 1.5.0.**

- [Download Windows and Mac](https://github.com/thelonewolfk32/guitar.io/releases/latest)
- [First-time GitHub and publishing guide](GITHUB_RELEASES.md)
- [V1.5.0 changes](CHANGELOG-v1.5.0.md)
- [Local sync](SYNC.md)
- [Mac preparation](MACOS_BUILD.md)

Windows: extract the ZIP and open `Guitar.io.exe` inside its folder.

Mac: extract the ARM64 ZIP, run `Prepare and open Guitar.io.command` once, then open `Guitar.io.app`. These are local test builds without an Apple Developer certificate or notarization.

Open **Help (?) → version number** for **Check for updates** and **Auto-updater OFF/ON**. Launch always checks for a newer release and shows a light-green download icon at the top right. Manual checks download and verify; click **Install update** when ready. Automatic updates download on launch and install when the library is idle. Close open views normally or use **Force install** after its unsaved-changes warning. Active saves/imports finish first; sync drains and saved data is committed before exit. Windows retains rollback until the library and a visible window open. Personal libraries stay in separate app data. Mac signs in the background; preparation failures keep the app open and record `update-install.log`.

Local workspace layout: open `Guitar.io.exe` directly in the main project folder. The active source stays under `development/guitar-io`; generated packages are under its `release/artifacts`. Old release copies are available through Git history and GitHub Releases. Keep the main folder intact when using the updater.

Enable Device sync on both computers and pair with the six-digit code. Wi-Fi and Ethernet can share a LAN. Your songs, artwork and progress stay in private app data and sync separately from application updates.

Build from source with Node.js 24: run npm ci, npm test and npm run build in development/guitar-io. The GitHub workflow packages Windows and Mac; a matching version tag publishes the release after checks. See GITHUB_RELEASES.md for the publishing steps and THIRD_PARTY_NOTICES.md for licenses. No iOS build is included.
