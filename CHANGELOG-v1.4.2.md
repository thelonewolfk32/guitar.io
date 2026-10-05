# Guitar.io V1.4.2

Windows x64 and Apple Silicon Mac update. No iOS build was requested for this release; the existing native project remains in the source for future work.

- Whole-song speed is a percentage slider/number field or a BPM field. Both use the same multiplier: 100→90 BPM is 90%, and 120→80 BPM is exactly two-thirds speed. The displayed reference comes from the attached GP's opening tempo and does not jump as sync intervals or later GP tempo changes are crossed. Section editors show percentage only.
- Windows/Mac control the selected embedded YouTube video's native playback rate for fine speeds, including 0.9× and exact BPM ratios. Pitch is preserved. Changes in YouTube's gear menu/keyboard are reflected in the main control. Requests and acknowledgements are ordered to prevent stale rate feedback; loading the media retains the chosen rate. If fine control cannot initialize or retain a speed, standard supported speeds remain active and failures are reported. Browser-only use retains YouTube's public API rate restrictions.
- Recording sync anchors remain in original media seconds. Changing playback rate stretches the wall-clock time between those anchors, and alphaTab follows the recording clock through the original sync map. Multiplying both saved anchors and video playback rate would incorrectly apply the slowdown twice. Neither original GP tempos nor recorded anchors are rewritten by a playback-speed change.
- Pop-up menus now share Learn's soft gradient surfaces, rounded green selectors/fields, spaced controls and icons. Artwork Stories retain their artwork-filled surface. Song headings return to the normal light foreground; the BPM field uses the same input treatment.
- Splicer keeps the complete scores visible. Click/Shift-click updates the range and its highlight; jumping to a section selects its name and scrolls to it. Matching bar rows and tab staff baselines stay aligned even when dynamics/text differ. A separate upload/URL panel opens from the upload icon. Imported source starting bars are aligned with the destination selection without removing the rest of either score.
- Comparison and preview follow the player's light/dark score mode. Preview shows the complete destination score, highlighting the affected range.
- Merge skips identical pitched notes with matching timing, duration and techniques after tuning conversion. Different notes remain for overlap/fingering review. Overwrite replaces the selected destination voices. Undo and original source bytes are preserved; dead-note Xs and dynamics do not inherit red note warnings.

IndexedDB schema, delta journal, LAN pairing, recent-song cache and lazy asset fetching are unchanged. No whole-library save, source rewrite or storage migration was added.

Mac remains a local development package: extract it on the Mac and run the included preparation/signing command once. Native macOS validation and Developer ID signing/notarization require the Mac.
