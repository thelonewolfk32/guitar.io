# V1.5.0 validation

- All 142 regression tests pass, including live sync activity, manual download/explicit install, force confirmation, hard save/import blockers, activation acknowledgement and paused incoming sync.
- TypeScript checks and the production build pass.
- Packaged Windows acceptance passes manual/force installation, the actual V1.4.4 native installer upgrading directly to V1.5.0, and deliberately failed startup with rollback. Tests check an OS window handle, saved three-song library, updater preference and unrelated files after restart. Disposable profiles and install folders are removed.
- Existing packaged player/splicer UI checks pass, including playback speed/BPM, YouTube bridge, light/dark comparison and menu styling.
- Tagged publication is gated on GitHub's Windows build/packaged updater tests and native Apple Silicon signing/replacement smoke on macOS 15 and 26. Native Mac results are visible in the release workflow; interactive MacBook Gatekeeper/playback remains a user-session check.
- No library schema change or full-catalogue save is introduced. Personal profile data is excluded from packages and Git. Windows/Mac use the same app.asar; archives include current release notes and licenses. No iOS build.
