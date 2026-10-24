# V1.6.2 MIDI mixer sync validation — 24 October 2026

This patch adds the optional `MidiMixer` song type, validates incoming mixer values in the shared sync contract before merge/admission, and validates the materialized desktop song. `src/sync-storage.ts` permits `midiMixer` in song metadata. An invalid page cannot advance the checkpoint, update field clocks, partially write preceding changes or clear a previous mixer through null-as-deletion handling.

`tests/midi-mixer-sync.test.mjs` exercises real desktop persistence and sync application with IndexedDB fixtures: metadata-only arrival before GP bytes, relay to another device, older songs without the field, 40 malformed structures/values, stale null rejection, deferred metadata rejection, inclusive volume bounds, empty and 256-track maps, unrelated metadata edits/full saves/remote merges and database reopen. Normal storage, migration and journal paths already spread/preserve complete song details; no destructive rewrite or schema reset was introduced.

`tests/sync-files-desktop.mjs` now sends a song containing mixer metadata through two packaged desktops and the encrypted LAN transport. It checks materialization, rejection of invalid master/track volumes without any song or sync-head changes, and retention after recipient restart, alongside complete GP/artwork/audio download and independent hosting.

## Local results

- All **215 automated regression tests pass**, including the five new mixer sync/persistence cases and 40 malformed-value/structure fixtures. No failures or skipped tests.
- Desktop, owner/admin, backend service and React Native TypeScript checks pass. Desktop/admin production builds pass.
- The rebuilt Windows production package passes encrypted two-device mixer/GP/artwork/audio sync, invalid master/track volume rejection with the complete song and sync head unchanged, independent hosting, restart and offline score opening.
- The packaged 50-GP/49-cover recovery test passes with a stale five-song selection and complete metadata checkpoints, then opens a score offline after restarting with the original host closed.
- Production-package manual/forced update, skipped-version installation and startup rollback checks pass, retaining synthetic libraries and unrelated files.

Windows is the local execution platform. The macOS arm64 production archive is constructed from the verified pinned Mac Electron runtime and the identical application ASAR, with binary formats, symlinks, modes, bundle versions, CRCs and ASAR identity checked by `scripts/package-mac.py`. Native execution/signing on Mac is a separate check; no physical iPhone or hosted deployment result is implied. Archive SHA-256 values are provided in `Guitar-io-1.6.2-SHA256SUMS.txt` alongside the builds.

The published V1.6.1 tag/downloads remain unchanged. V1.6.2 packages are separate candidates until explicitly published.

Both local production archives were created and checked. The Windows ZIP passes CRC validation; the Mac packager passes its arm64 executable, bundle, CRC, permissions and symlink checks. Extracted Windows/Mac application ASARs are byte-identical (`fb7de5f524e4b75f36c3014f28d788e4c7547853d66fa691ebe73e77255600fd`), contain package version 1.6.2 and the compiled mixer validator, and match the application exercised by the Windows LAN tests.

| Local candidate archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `Guitar-io-1.6.2-Windows-x64.zip` | 167811389 | `442e5b69064fa1eb4670da527e6eaabfc7efc5d25ec3ec575902077245b4d5ba` |
| `Guitar-io-1.6.2-macOS-arm64.zip` | 135264965 | `c77be926bff4391c7c1b9a2af9cc21aa42b8ea29ee07c592b64962e3131a664d` |

## Desktop CI

[PR #3](https://github.com/thelonewolfk32/guitar.io/pull/3), code commit `75e1569c6bac75a70c49f5a4822d45b7e4a2bcd1`, passed the [Windows/macOS production package workflow](https://github.com/thelonewolfk32/guitar.io/actions/runs/40081432062). Windows packaging/regressions/updater checks and both macOS 15/26 jobs succeeded. The Mac jobs ran the rebuilt application, local signing/updater checks, the encrypted mixer acceptance/atomic rejection/restart regression in `sync-files-desktop.mjs`, and the 50-GP/49-cover recovery test. This establishes native Mac CI execution in addition to local archive validation. It does not establish signing or acceptance on the owner's personal Mac/iPhone. The publish job was skipped because this is a pull-request candidate, not a release tag.

The React Native unsigned simulator workflow is separate and was still running when desktop acceptance completed; no updated physical iPhone was built or installed here. Subsequent documentation-only evidence does not change the tested runtime source. CI archives can differ from the local candidates above; use each download's own checksums.
