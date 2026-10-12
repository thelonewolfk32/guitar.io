# Guitar.io 1.5.1 validation

Prepared on Windows, 13 October 2026, from source baseline `c7701cf` (V1.5.0 tag `d891480`) plus the complete-file sync changes. The release source is identified by tag `v1.5.1`. Node.js 24.19.0; pinned Electron 44.4.5; Capacitor 8.5.2. Tagged publication is gated by the Windows and macOS Actions checks.

Verified:

- TypeScript typecheck and production Vite/LAN build.
- Full serial unit test suite: **151 passed, 0 failed**, including metadata merge/checkpoint compatibility, file queue repair, GP/audio/artwork persistence, checksum/size validation, interrupted downloads, client uploads and competing transfer ownership.
- Two isolated Windows desktop apps, including the final packaged V1.5.1 executables: encrypted LAN transfer of three genuine synthetic Guitar Pro scores, three artwork files and a 1.2 MB attachment transferred in multiple chunks; no repeated file transfer on a no-change sync; repair of an older metadata-only song without re-pairing.
- Restarted the receiving Windows app with local sync disabled and the source app closed, then opened the synced score and reached the player-ready state.
- Packaged Windows updater: manual download/force install to a synthetic newer version, skipped-version replacement from the real V1.4.4 installer to V1.5.1, and failed-startup rollback. All three preserved the isolated library and unrelated files and restarted with a visible native window.
- Desktop and 393 × 852 Help screenshots inspected: two short instructions, no long help note, no horizontal overflow. Learn displays its beta label.
- Capacitor sync copied the current production web assets into the existing iOS project. This refreshes assets and package configuration; it does not compile or sign Swift.
- Apple Silicon Mac package uses the cached official Electron 44.4.5 runtime with SHA-256 verification, arm64 executable/mode and framework-link checks. Mac and Windows packages share the same application ASAR.

The attachment fixture tests byte transport and persistence, not MP3 decoding. Windows tests use temporary profiles; the user's library is not copied or modified.

Pending: native Swift/Xcode compilation and signing, macOS launch/Gatekeeper/playback, iPhone MIDI audio output, real iOS foreground/resume and phone-to-desktop transport, and three-device testing. The shared upload protocol has unit coverage; this does not establish real-device iPhone compatibility. Hidden scrollbars require a final native iOS visual check.
