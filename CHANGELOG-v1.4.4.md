# Guitar.io 1.4.4

Updates now download, verify, install and restart Guitar.io from the app. Open Help (?) and click the version number to find Check for updates and an Auto-updater OFF/ON switch. Repository fields, external links, extra buttons and explanatory menu text have been removed.

- Manual checks install an available update with one click. Automatic updates download on launch and install when the library is idle. Playback, editors, active saves and syncing defer installation.
- Downloads require the release's SHA256 digest, exact platform package, expected app identity and matching version. Archive paths and links are validated before extraction.
- Windows replaces packaged files in the existing folder, preserves unrelated files and the separate library, and rolls back a partial replacement failure.
- Mac prepares and locally signs a staged app, swaps it after Guitar.io closes, and reopens it. When preparation fails, the app offers the command and macOS approval instructions. Apple Developer signing/notarization is still not configured.
- The existing launch-check preference is retained as the Auto-updater preference. Libraries, pairing and sync checkpoints remain unchanged.

V1.4.3 contains the earlier download-only checker. Install V1.4.4 once using that checker/manual package replacement; its built-in installer handles subsequent releases. Native Mac updating requires testing on the MacBook.
