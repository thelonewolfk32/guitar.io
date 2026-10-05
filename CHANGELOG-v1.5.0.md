# Guitar.io 1.5.0

- Windows updates restart Guitar.io visibly. Reopening an existing instance explicitly shows its window.
- Startup checks run even with automatic updates off. A newer release adds a light-green download icon at the top right, with an update tooltip and no visible text.
- Manual updates now follow **Check for updates → download → Install update**. Downloading manually never starts installation automatically in that session.
- Installation reads live sync activity instead of a stale view state. Open players/editors get a specific explanation and an optional **Force install** confirmation. Active saves/imports must finish; sync drains and saved changes are committed before exit.
- Windows retains rollback files until the updated library loads and the native window is visible. Startup failure restores the previous app and pauses automatic installation attempts.
- Updates replace complete platform packages, so intervening versions are unnecessary. Library/profile data and unrelated app-folder files remain separate from replacement.
- Packaging uses the pinned Electron dependency, without old release folders. New artifacts go in the source project's `release/artifacts` folder.

Windows x64 and Apple Silicon Mac packages. No iOS build. Mac signing remains local preparation without Apple notarization.
