# V1.4.3 validation

An isolated offline copy of the PC profile contained all 49 songs and valid attachment metadata. Replaying its journal reproduced the old incomplete-metadata failure. The repaired replay received all 49 records, including Alpha, .44 Caliber Love Letter, Blood Moon and Control with album names and last-played timestamps. No GP/audio bytes were needed for the catalogue replay. The app and LAN service never ran against the real profile during this audit.

Tests cover unseen-entity base recovery, note edits, activity, album metadata, atomic checkpoints, idempotent merges, lazy sources and the existing 300-song delta query. Updater tests cover numeric versions, platform assets, repository/download validation, ETags, coalesced checks, offline operation and no automatic downloads.

Mac packaging uses the SHA256-verified official Electron 44.4.5 ARM64 runtime and preserves framework links and executable modes. Native Mac playback and recovery require checking on the MacBook. The user could not recreate the one-way pairing issue; no firewall/network settings were changed.

TypeScript and the production build passed. All 129 model/component tests passed serially. Packaged Windows acceptance passed with two isolated profiles and a 49-song encrypted HTTP transfer: metadata baseline repair across pages, album and playback-history fields, zero GP downloads during catalogue sync, an OFF-by-default diagnostics toggle, a report excluding pairing secrets, and a mocked newer release opening the Windows-specific download. Existing native LAN acceptance also passed: encryption/replay rejection, pairing, lazy GP files, metadata and progress changes, head-only idle/restart checks, persisted caches, offline reopening and deletion propagation.

The updater menu was visually inspected. Source and release packages exclude the private audit copy. Native Mac execution remains a MacBook check.
