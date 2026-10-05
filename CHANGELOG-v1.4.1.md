# Guitar.io V1.4.1

- Tooltips cover controls in the library, player, modal menus and Learn window. Disabled buttons use a normal cursor.
- Guitar collections offer **Add tunings** for the selected guitar. The tuning picker confirms with **+ Add tuning**.
- Learn uses the player’s green gradients, rounded controls, tuning families, icon actions and roomier layouts.
- Song and artist share a compact header beside Back. Song sections can collapse; YouTube can minimize while playback continues. Zoom starts and resets at 100%.
- Added a one-bar MIDI count-in beside the player settings. The imported/saved GP tempo remains; the song tempo editor has been removed.
- Playback speed can display percentage or BPM. Video rates come from the selected YouTube video’s supported list; BPM entries snap to a playable rate. Measured sync timing supplies the recording BPM, including repeat occurrences.
- Recording offsets use a −16 to +16 bar slider. Bar duration follows meter and recording BPM where known. Moving the offset shifts every saved video anchor equally, including negative offsets.
- YouTube sync points are collapsible; recording Save/Remove use themed tick/trash icons. Sections with valid video timestamps can change speed while the video remains the clock. Fixed recording timestamps are retained when slowing playback: changing their original timestamps would introduce drift. Source GP/MIDI tempo is not rewritten.
- Inserting an overlapping section keeps and renames the surrounding ranges (Verse 1 → Solo → Verse 2), preserves their progress/setup/notes, and supports existing Undo.
- Device sync puts the Wi-Fi OFF/ON switch first. Six-digit device codes remain visible; **+ Add device** starts pairing. Both screens compare verification digits before exchanging the sync key. Pairing uses committed P-256 ECDH keys/nonces, HKDF-SHA256 and AES-GCM; six digits are never used as a storage encryption key.
- Explicit **Auto sync** enables background update checks. Manual Sync now works with Auto sync off. Paired desktop connections are reciprocal; code resets update discovery. Removed devices are rejected locally until approved pairing is repeated.
- Existing changes-only checkpoints, per-field timestamps, lazy file fetching, offline caching and immutable GP originals remain in place. No new library migration or whole-library save is added.

Windows x64 portable package, Apple Silicon Mac package and iOS Xcode project are supplied. The Mac prepare command is still needed for unsigned local testing. Native Mac/iOS execution, Swift compilation and signing require verification on the Mac; the iOS ZIP is not an IPA.
