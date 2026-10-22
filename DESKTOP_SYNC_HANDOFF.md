# V1.6 desktop file replication — 22 October 2026

This repair responds to the iOS `1.6.0-sync-diagnostics-161` handoff. That phone build and its newer iOS changes are maintained on the owner's Mac; they are not presumed to be present in this checkout. Preserve that working copy. Merge the focused native pairing changes below rather than replacing the Mac's mobile folder from the desktop Source ZIP.

## Install and recover

1. Export a recoverable library backup on each computer. Install the V1.6.0 Windows and Apple Silicon Mac builds over their existing installations, preserving their normal profiles.
2. Open Guitar.io on the computer holding the originals, enable Device sync, and use Sync now. Startup/manual checks register verified local legacy GP/artwork bytes and rebuild pending queues. Existing identities, field clocks, edits, progress, tombstones and per-peer checkpoints remain intact.
3. Pair PC and Mac with the six digits, confirm the matching verification digits on both, and keep both apps awake until transfers finish. If Bonjour is unavailable, enter the other computer's `IP:port` in the optional LAN-address box; addresses are shown in Device sync. Allow Guitar.io through Windows Firewall on the private network and allow Local Network access on Apple devices. The app does not alter firewall rules.
4. Check Device sync → Show diagnostics → Export report on each computer. Compare local source/artwork counts with missing reference counts, queue size and pull/push checkpoints. Reports include local names/addresses, never file bytes or pairing keys. A missing source is explicit: metadata alone cannot recreate the GP file. Restore the original from a full backup if no paired device has it.
5. After Mac downloads complete, close the PC. Open several GP files and album covers on Mac offline; then connect the foreground iPhone to the Mac. Repeat with the PC directly if required. Confirm the real 50 GP/49 artwork counts, restart all devices, and open multiple songs with both computers unavailable before accepting the personal library.

## Protocol and storage

- `head`/`hello`: protocol 3, `contentUpload: true`, `contentManifest: true`; existing encrypted V1.5 envelopes and pairing authentication are retained.
- `content-manifest`: sorted `asset/<id>` then `source/<id>` items, `after`/`more` pagination; each item reports actual byte availability, ID, name, MIME, byte count and hash. Metadata-only and quarantined corrupt records are unavailable.
- `blob`: existing 512 KiB encrypted chunks, offsets, size and hash. GP SHA-256 and hashed attachments are checked before committing. Persistent prefixes and queues survive restarts. GP downloads take priority over artwork/audio.
- Up to 500 metadata rows within the existing approximate 1 MiB page budget; legacy peers retain 100-row requests and base repair compatibility. Large single edit records keep the prior exception.
- Repair is restricted to the active account database. It recovers split originals, embedded legacy song bytes/base64, and same-hash duplicates within that library. This app has no separate authoritative Electron import-directory cache. It never scans another account/profile or substitutes a generated thumbnail for missing original artwork. Full backup restore remains the recovery path for bytes outside the active library.
- A completed queue alone is insufficient: offline status also checks all required GP/attachment references, metadata checkpoints and peer errors. An absent descriptor remains a pending problem.

## iOS integration

The desktop manifest matches the supplied build-161 schema; no desktop credential enters the score WebView. `shared/lan-endpoints.mjs` and the focused `NativeLAN.beginPair`/`finishPair` changes in `mobile/src/lan.ts` add all-endpoint retry, link-local-last ordering, direct-address support, bounded endpoint timings and the successful address first. Merge these into the newer iOS implementation without losing its embedded `ScoreWeb/rn-main.jsbundle` fix, durable queues, reusable sessions or diagnostics. Exposing the optional address argument can use the already-existing build-161 UI. The main React Native handoff remains `IOS_REACT_NATIVE_HANDOFF.md`.

## Evidence

`tests/lan-manifest.test.mjs` covers legacy registration, stale queues, missing descriptors, hash corruption, account isolation, pairing fallback and the exact 50/49/zero-queue failure. `tests/native-lan-pairing.test.mjs` executes native pairing JS with a refused first address. `tests/sync-files-desktop.mjs --packaged` uses two real isolated desktop profiles and encrypted HTTP, verifies complete GP/artwork/audio downloads, repairs a stale initialized queue, closes the original host, downloads every file from the independent recipient, restarts it and opens a score offline. The release workflow also runs that packaged test on both Mac CI versions.

CI cannot establish the owner's actual firewall rules, Bonjour behavior on their network, the missing originals' location, or build-161 acceptance on their iPhone. Export both desktop reports if any file is still missing; do not clear checkpoints or uninstall to troubleshoot.

Tested implementation: `76dd399959c9eb850695088dd323a62feabe6a50`. All 200 regression tests and the Windows/macOS 15/macOS 26 checks passed in [run 37](https://github.com/thelonewolfk32/guitar.io/actions/runs/39745851367). Subsequent documentation commits preserve that executable code. The tag-triggered workflow repeats the release gates before publication.
