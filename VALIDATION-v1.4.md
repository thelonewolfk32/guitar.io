# V1.4.0 validation

Windows host, October 5, 2026. All profiles, songs, artwork and networking tests are isolated/synthetic. Real Guitar.io library is untouched.

## Completed

- Strict TypeScript and production Vite build.
- 118 unit/component tests, including per-field conflict ordering, duplicate suppression, encrypted-message integrity, private endpoint restrictions, delta projection, source laziness/checksum, chunk resume, atomic failed-page rollback and deletion retention.
- Actual encrypted HTTP between two separately packaged Windows profiles: pairing; schema-2 migration; catalogue without GP bytes; title change; bidirectional section mastery; unchanged sync sends only `head`; cached GP offline reopen; deletion/ownership cleanup and replay rejection; persisted checkpoints/cache across cold restart. No external internet source required.
- Packaged V1.3 import/YouTube timing/Space/UI cleanup regressions and Splicer comparison/preview/range-only save/Undo/separate GP tests.
- Packaged V1.2.3 MIDI output sample rate, mixed-tuning/tempo Stories/cache isolation/online-estimate regressions; V1.2.4 native audio/YouTube rates and tempo controls.
- 393px phone browser viewport: catalogue within screen, MIDI file opening/readiness, accessible player settings. Screenshots visually inspected; native iOS is not implied.
- 300-song incremental storage check: one title edit returns one row, 595 bytes of delta JSON, zero source reads/writes; isolated fake-IDB transaction/query measured about 3.5–3.9 ms and retained 2,028 diagnostic events. This measures the incremental algorithm, not phone/LAN playback performance. Encrypted framing, HTTP headers and Bonjour add overhead.
- iOS template/project generation and asset sync; native plugin references, local network/Bonjour declarations, scene lifecycle and version/deployment settings checked structurally.
- Release archive checks, official Electron arm64 runtime hash, matching desktop ASAR, executable modes and Mac framework links are checked by packaging scripts.

## Still requires Mac/iPhone

Swift/Xcode compile, provisioning/IPA, native WebKit audio/file import/export, YouTube embedding, physical LAN discovery/permissions/firewalls, Apple Silicon app launch/signing and real three-device interoperability. See IOS_HANDOFF.md. iOS only syncs while open/resumed; no indefinite background execution. Devices must be awake and paired. IPv4 LANs only; no direct iPhone-to-iPhone host or cloud service. Section validation can block a conflicting page until the overlapping ranges are corrected on a source device. Same-field offline conflicts use deterministic last-write-wins.

Final artifact checksums are in Guitar-io-1.4.0-SHA256SUMS.txt. Test screenshots/profiles/runtime caches are excluded from release/source ZIPs and removed after validation.

