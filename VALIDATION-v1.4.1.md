# V1.4.1 validation

Completed on Windows with isolated synthetic data; the real user profile was not opened or edited by tests.

- Strict TypeScript and production web/LAN builds.
- 122 unit/component tests, including overlap insertion/tail preservation, meter/BPM bar offsets, negative anchor shifts, actual supported speed snapping, immutable GP timing, commitment verification, required host approval, encrypted one-time pairing, peer removal and saved Auto sync preference.
- Browser UI: adjustable/resettable 100% zoom, count-in wired to alphaTab, BPM and percentage modes, unsupported YouTube BPM snapping to a real rate, collapsed sections increasing score width, overlapping section insertion, hidden tempo editor, minimized video staying in playback, bar-offset save/seek, guitar collection Add tunings and + Add tuning, disabled cursor, Learn tuning families and 393px layout. Screenshots visually inspected for player, Learn and sync menus.
- Historical player regressions: source switching and independent MIDI section/whole-recording speeds, native recording rate changes, real HTMLAudio playback, direct Songsterr import without a popup, variable timestamps, Space transport, editing/reopen without refetching or source rewrites, and phone viewport access.
- Two packaged Windows apps: real Bonjour six-digit discovery, matching verification on both screens, key withheld until host approval, encrypted pairing, reciprocal device entries, reset-code propagation/re-pairing, persisted Auto sync off, manual Sync now.
- Two packaged Windows profiles: real encrypted HTTP, replay rejection, legacy schema upgrade, metadata-only catalogue sync, GP download only on opening, changed title/progress propagation, idle/restart head-only checks, offline cached reopen, persistent checkpoints and deletion propagation.
- Existing 300-song regression: one changed row (595 JSON bytes), zero original source reads/writes. This verifies incremental data access; it is not a new native-phone performance benchmark.

Release verification checks ZIP CRC/SHA256, matching Windows/Mac ASAR content and current version, arm64 binaries/executable modes/framework links, current iOS embedded assets and project version, source completeness, exclusion of dependencies/profiles/test data and unchanged V1.2.4 baseline.

Pending on the Apple Silicon MacBook: native Mac launch and local signing; Xcode simulator/device compilation; WebKit audio/YouTube/file import/export; actual Windows–Mac–iPhone LAN interoperability. Follow IOS_HANDOFF.md. iOS sync runs while foregrounded/resumed, not as a permanent background server. YouTube tests use a controlled API adapter; public-video network behavior still needs device checks.
