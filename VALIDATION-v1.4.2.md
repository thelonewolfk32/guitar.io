# V1.4.2 validation

All acceptance runs use synthetic songs and isolated browser/Electron profiles. The real library is untouched.

- TypeScript and production Vite build pass.
- 125 model/component tests pass serially, including storage/delta sync, previews, pitch/tuning, recording timing, splice metadata/undo, duplicate removal and fine-rate frame validation.
- `tests/v142-ui.mjs` passes in browser and Windows Electron: equivalent BPM/% edits; a stable reference across imported tempo changes; matching rounded inputs; full-score comparison and preview; click/Shift-click range; section selector label; aligned staff baselines; light/dark rendering; collapsed import; shared gradient menus. Desktop additionally verifies 0.9× and exact 2/3 native video rates, direct gear feedback, original seek anchors iframe isolation and honest supported-rate fallback after a native failure.
- Existing V1.4.1 UI and V1.2.4 playback regression checks pass: offsets, Learn/tuning interactions, count-in, zoom, section collapse, MIDI section speed, constant audio backing speed and source changes.
- Existing Splicer acceptance passes: save/reopen, undo, imported GP pitch conversion, destination metadata and no original source write.
- Live YouTube's official sample embed accepted 90%, 110% and 66.666…% in its native HTML video. Its media stream did not load on this host (duration remained unavailable), so continuous real-stream timing remains a manual check. Controlled recording-clock tests cover seeks and playback mapping.

Platform limits: Windows is executed here. The Apple Silicon archive is validated structurally and against the same app.asar; native Mac playback/signing must be checked on the MacBook. No iOS package or native iOS verification is part of V1.4.2.

Playback controls for fine YouTube speeds depend on the embedded desktop player's HTML media element. Public API fallback remains available if that integration changes.
