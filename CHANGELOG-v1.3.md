# Guitar.io v1.3.0

- Direct Songsterr URL imports use public metadata/track JSON and alphaTab GP export, with no external downloader window or import-review popup. Supports track-suffixed links such as Money s15761t4, compressed track JSON and CDN failover. Saves a primary full-song and available backing video.
- Per-recording YouTube bar timestamps can be fetched, reviewed, edited and saved. They map variable timing without changing MIDI tuning/tempo. Complete validated timestamp coverage allows section speed changes; other recordings retain whole-song speed.
- Fixed a reentrant seek/speed change that moved the playhead to the wrong bar. Speed changes wait for the seek to finish.
- Space consistently controls the open MIDI/recording player from focused controls, inputs, menus and dialogs. Instructional playback uses the same shortcut.
- DNA Splicer beside the instrument selector: shared-scroll, readonly comparison, part selection, section jumps, bar ranges, directional merge/overwrite, result preview, red conflict hints, separate GP/Songsterr input, and persistent Undo merge. Destination metadata/tuning/tempo/sync points remain authoritative. Original source bytes are preserved; saved splices and their journal patches contain affected ranges only.
- Removed requested suggested-section, song-map and section-speed explanatory sentences.
- MIT attribution for teaqu/guitar-pro-youtube-sync. No Python/FFmpeg/yt-dlp runtime dependencies.
- Windows x64 portable release and Apple Silicon testing ZIP with the separate local Mac prepare command. Native Mac verification remains required on the MacBook.
- Cleanup retains V1.2.4 and current releases, active source/tests and current performance/sync documentation; older packages, duplicated sources and temporary test data are removed.
