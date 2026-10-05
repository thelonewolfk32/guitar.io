# V1.4.4 validation

The update-specific checks cover hostile archive paths, duplicate entries, unsupported links, wrong checksums, removed partial downloads, package identity/version, deduplicated staging, real Windows file replacement, unrelated-file preservation and rollback after a partial failure. Existing sync and player model/component checks remain included.

Packaged acceptance exercises the hidden minimal menu, preference persistence, an available update while a player is open, verified download, actual installed-file replacement, restart into the newer version and reuse of an isolated library. Test packages and profiles are separate from the real library and deleted after testing.

Mac packaging preserves executable modes and framework links in the verified official ARM64 runtime. Mac-specific replacement, signing and approval require execution on the MacBook; Windows testing does not establish native Mac compatibility.

Verified locally: TypeScript and production bundling passed; all 133 regression tests passed. Packaged Windows acceptance passed a synthetic 1.4.4 → 1.4.5 update with actual replacement and restart, the same three-song IndexedDB library, persisted preferences, and an unrelated file retained. Active playback prevents installation. Replacement and forced partial-failure rollback tests passed. Temporary acceptance packages/profiles were removed.

The release workflow also gates publication on a native Apple Silicon signing/replacement smoke test. It runs the supplied unsigned release through the actual Mac update command, verifies the resulting signature and replacement, preserves the isolated profile, and checks rollback/staging cleanup. Its result is recorded in GitHub Actions; it does not exercise user-session Gatekeeper approval or GUI relaunch.
