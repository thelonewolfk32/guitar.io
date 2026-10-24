# Guitar.io 1.6.2

Accepts the iPhone's optional per-song `midiMixer` metadata during desktop LAN sync. Windows and Mac retain master volume and per-track volume, mute and solo settings through sync, normal song saves, unrelated edits and restart. Older songs without mixer metadata remain unchanged. This patch preserves the settings; it does not add desktop mixer controls.

Validates the complete mixer before merging any incoming page: finite master volume from 0 to 1, at most 256 tracks with non-negative decimal index keys, finite track volumes from 0 to 1.5 and boolean mute/solo values. Rejects nulls, arrays, missing required fields and unknown mixer/track properties. Invalid pages leave the previous song metadata, sync head and pull checkpoint untouched, including stale and deferred changes.

The temporary 1,000-song testing policy and existing file/storage allowances remain unchanged. No hosted migration or iPhone schema change is required for this contract fix.
