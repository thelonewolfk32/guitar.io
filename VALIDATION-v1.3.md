# V1.3 validation

- 107 unit/component regressions: pass.
- Strict TypeScript / production frontend build: pass.
- Packaged Windows V1.3 acceptance: direct paste import with one app window, preserved tuning/tempo, variable YouTube timestamps, complete-point section speeds, Space from focused controls/settings, timestamp editing and reopen without source writes/refetches, requested copy removal: pass.
- Packaged Windows Splicer: readonly comparison/shared scroll, section jumps, merge preview/red pitched-note warnings, range-only saves, persistent Undo merge, separate GP import, destination tuning/tempo/title, save/reopen: pass.
- Existing V1.2.4 Windows MIDI/audio/unsynced-YouTube rates, native rate changes, tempo icons, edit/restore: pass.
- Existing V1.2.3 Windows actual audio sample rate, mixed tuning/tempo Stories, synth isolation/cache reuse, online tempo lookup/opt-out, YouTube layout: pass.
- V1.3 and Splicer browser acceptance: pass; popup previews visually inspected.
- Live Songsterr Enter Sandman: nine tracks, 174 bars, 123 BPM, 7,911 notes retained through GP export/reimport. Multiple complete and partial video timestamp sets accepted.
- Live user-provided Money URL s15761t4: 11 tracks, 162 bars, 119 BPM. Multi-guitar range splice verified with destination title and tempo unchanged.
- Apple Silicon ZIP: official Electron runtime SHA256 verified; five arm64 Mach-O executables, Unix modes, bundle/helper metadata and framework symlinks checked; macOS 13 minimum; ASAR matches Windows. Native Mac launch/signing/playback remains pending on the MacBook.

Public YouTube audio/embedding availability and subjective timbre were not verified by controlled adapters. Partial timestamp tails use the last measured interval. Splicer red hints are a heuristic; time-signature/pickup mismatches are refused. Earlier 300-song benchmark is retained; it was not repeated for this release.

Tests use isolated synthetic libraries/profiles. No real profile data is changed or included in artifacts. Live score fixtures, test profiles/screenshots and downloaded runtime caches are removed after packaging.
