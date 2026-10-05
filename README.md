# Guitar.io

A local guitar library and practice player for Windows and Apple Silicon Mac. Import Guitar Pro or Songsterr tabs, organise songs and guitars, track section progress, practise with MIDI or YouTube, and splice parts into a learning arrangement.

**Current version: 1.4.41.**

- [Download Windows and Mac](https://github.com/thelonewolfk32/guitar.io/releases/latest)
- [First-time GitHub and publishing guide](GITHUB_RELEASES.md)
- [V1.4.41 changes](CHANGELOG-v1.4.41.md)
- [Local sync](SYNC.md)
- [Mac preparation](MACOS_BUILD.md)

Windows: extract the ZIP and open `Guitar.io.exe` inside its folder.

Mac: extract the ARM64 ZIP, run `Prepare and open Guitar.io.command` once, then open `Guitar.io.app`. These are local test builds without an Apple Developer certificate or notarization.

Open **Help (?) → version number** for **Check for updates** and an **Auto-updater OFF/ON** switch. Manual checks download, verify, install and restart when an update is available. Automatic updates download on launch and install while the library is idle. Return to the library and close editors before installing. Personal libraries stay in separate app data. V1.4.3 users must install V1.4.4 once manually; later releases use its built-in installer. Mac updating attempts local preparation and offers approval instructions if it cannot finish.

Enable Device sync on both computers, add the other device's six-digit code, and confirm the matching verification digits. Wi-Fi and Ethernet can share a LAN. Install V1.4.3 or later on both devices to repair earlier incomplete-metadata errors. Sync diagnostics shows stages and errors and exports a local report without pairing secrets or tab/audio bytes.

## Build from source

Use Node.js 24, npm, and Python 3.12 or newer for Mac packaging.

```sh
npm ci
npm test
npm run build
```

GitHub Actions checks and packages Windows and Mac from `main`. A version tag publishes a release after successful checks. The Mac package uses the SHA256-verified official Electron ARM64 runtime; native Mac testing remains necessary. No iOS build is included in this update.

See [GITHUB_RELEASES.md](GITHUB_RELEASES.md) for local packaging and publishing. Third-party licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The application's package currently declares `UNLICENSED`.
