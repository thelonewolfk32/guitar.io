# Guitar.io project guidance

## Start here

The current desktop baseline is **1.5.0**, tag `v1.5.0` (`d891480`). Read `CODEX_CURRENT_HANDOFF.md` and `package.json`. For Mac/iPhone work, also read `IOS_HANDOFF.md` and `SYNC.md`. Treat the current user's instructions as the scope; this file does not authorize additional releases or builds.

This repository root contains `package.json`, `src`, `electron`, `shared`, `scripts` and `ios`. The original Windows workspace keeps this checkout under `development/guitar-io`; a GitHub clone is already the source root.

## Platform and tools

- React/TypeScript/Vite is shared between Electron desktop and Capacitor iOS. Continue the existing implementation instead of replacing it with a second app or an unrelated SwiftUI rewrite.
- Use the lockfile and Node.js 24. Capacitor is pinned to 8.5.2; Electron to 44.4.5. Read package scripts before running commands.
- `npm run ios:sync` builds/copies current web assets into the existing iOS project. Run it after web changes before native testing. Do not run `cap add ios` again. Generated web assets are excluded from Git.
- Xcode project: `ios/App/App.xcodeproj`, scheme `App`. Native compilation/signing requires a Mac. Xcode 26.3+ provides Apple's external-agent MCP bridge via `xcrun mcpbridge`; verify tools and open project before relying on it.
- Preserve `GuitarLocalPlugin.swift` registration through `GuitarViewController`, SceneDelegate and storyboard. Check native file imports/exports, WebKit audio and YouTube on a real device.
- User has Apple Silicon, last reported Sequoia 15, and no paid Developer membership. Verify current OS/SDK compatibility. Personal Team is for temporary personal-device testing; do not report an uncompiled project as an installable IPA.

## Storage and sync compatibility

- Keep IndexedDB `guitar-io-v1`, schema 4; desktop `guitario://app/`; iOS `capacitor://localhost`. Preserve installed desktop profiles and device identities. Do not copy a whole profile between devices.
- Home-screen reads use lightweight summaries. Original GP/audio/artwork reads are lazy; saves journal individual changes. Avoid full-library reads/writes during routine navigation or sync.
- Reuse field clocks, tombstones, per-peer pull/push checkpoints and atomic apply/checkpoint in `src/sync-*`/`src/lan-sync.ts`. Preserve missing-base repair for unseen song entities. Do not replace these with one global last-synced timestamp.
- Recent activity, album names and artwork references are metadata. Missing artwork must not stop song metadata arriving. Keep Story preview tuning/BPM/cache isolated per song.
- LAN envelopes/pairing must remain compatible with V1.5 desktops. Keep private-address validation, encryption and verified six-digit pairing. iOS is a foreground/resume client of desktop hosts; do not claim continuous background service or direct phone hosting.
- Keep private songs, backups, GP/audio, profile files, pairing codes/keys and credentials outside Git/public artifacts. Use isolated fixtures for verification.
- Preserve V1.5 desktop updater startup/rollback and save/sync draining. Native iOS uses Xcode/TestFlight installation rather than desktop update ZIPs.

## Checks and handover

For functional source changes, run relevant tests (`npm test`, `npm run typecheck`, build/native checks as appropriate). For documentation-only work, check links, commands and `git diff --check`; do not rebuild merely to validate prose.

Record the source commit and actual platform/SDK/test results. Mark unperformed Mac/iPhone checks as pending. Update the handover when native findings change.

GitHub repository: `https://github.com/thelonewolfk32/guitar.io`. Use the existing clone/branch and preserve user changes. Published version tags and release ZIPs are immutable; new functional releases need new versions. Personal-library LAN sync is separate from Git/GitHub source updates.
