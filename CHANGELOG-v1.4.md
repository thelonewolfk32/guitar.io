# Guitar.io 1.4.0

- Optional paired local sync over the same Wi-Fi or Ethernet LAN. Windows/Mac advertise through Bonjour; iOS connects bidirectionally to either desktop.
- AES-256-GCM authenticated encrypted messages, per-peer checkpoints, field-level timestamp/device/sequence conflict ordering, keyed edits, persistent deletion tombstones, atomic application and duplicate suppression.
- Initial catalogue/edit metadata transfers once; further requests send only changed fields. GP/audio download in 512 KiB chunks when opened, then remain cached for offline use. Artwork fetches as visible cards request it.
- Idle revision checks, debounced saves, two simultaneous downloads, resumed transfers, 64 MiB/seven-day temporary cache and diagnostic journal compaction. No full-library exit save.
- Incoming edits apply from the library to preserve an open player/editor. Devices must be awake with Guitar.io open. iOS catches up on foreground resume.
- Capacitor 8.5.2 Xcode project, native Wi-Fi-only LAN requests, Bonjour privacy declarations, direct Songsterr bridge, offline synth assets and phone layout. Native compilation/signing/testing on Mac is required; see IOS_HANDOFF.md.

Existing profiles/original bytes are preserved. IndexedDB upgrades once from schema 3 to 4, retaining device identity. Backups stay format 2. Sync is off until enabled. No cloud service is enabled.
