# Guitar.io 1.5.1 sync-fix handover

This is the complete-file sync fix requested on 11 October and prepared on 13 October 2026. Use V1.5.1 source/build artifacts from [the checked release](https://github.com/thelonewolfk32/guitar.io/releases/tag/v1.5.1) for this fix.

The previous application synced metadata and fetched originals only when opened. That produced the reported “file is not available from an awake paired device” error after the source app closed. The new version retains metadata deltas and queues missing GP/audio/artwork bytes in the existing IndexedDB settings store. Queue insertion and metadata checkpoints commit atomically. A one-time presence check repairs older placeholders; normal checks read the small queue. Completed files remain in IndexedDB and do not expire with temporary transfer chunks.

The existing database `guitar-io-v1`, schema 4, app origins, identities and pairings remain intact. The encrypted LAN protocol stays compatible with V1.5 hosts. Updated hosts advertise `contentUpload` and accept resumable file uploads over an iOS client's outgoing connection. Files have a single transfer owner; an opening request joins an active upload, and an active pull defers competing uploads. Original GP files retain SHA-256 verification. Files still need an awake paired source for their initial transfer. YouTube links and timing metadata sync; YouTube video bytes are not downloaded.

## Use the desktop build

Close the old app, extract the new Windows ZIP and run its `Guitar.io.exe`. On Apple Silicon Mac, extract the Mac ZIP and run `Prepare and open Guitar.io.command` once. The Mac package is a local test build without Apple notarization; its Mac runtime checks are pending.

Use the new build on both desktops, enable Device sync, and choose **Sync now**. Keep the apps open on the same LAN until **Files saved for offline use** appears and there are no sync errors. Existing pairings and checkpoints can be reused. Test opening a song after disconnecting the source device.

## Refresh iPhone on the Mac

Pull the current GitHub source containing tag v1.5.1, or use the V1.5.1 source ZIP. In the source folder, with Node.js 24 installed:

```sh
npm ci
npm test
npm run ios:sync
npm run ios:open
```

Build scheme **App** from `ios/App/App.xcodeproj`, version **1.5.1 / build 151**. Native compilation and signing must be performed on a Mac. A source/project archive is not an installable IPA.

Test desktop → iPhone GP/audio/artwork downloads, phone import → desktop uploads, resumption after suspension and network loss, offline opening after restart, and all three devices together. Upgrade desktop hosts for phone file uploads. iOS remains a foreground/resume client.

## Remaining MIDI audio investigation

Reproduce the silent playback on the real iPhone. Check alphaTab player readiness, bundled soundfont/worker loads, AudioContext state after tapping Play, output volume and mute state, and the native WKWebView/audio-session behaviour. `GuitarViewController.swift` currently registers the local plugin and does not configure an AVAudioSession. That is an investigation lead, not a confirmed diagnosis. No untested audio-session change was made on Windows.

Help, Learn (beta) and hidden scrollbars are shared React/CSS changes and must be copied with `ios:sync`. See [validation](VALIDATION-v1.5.1.md) and [monetisation advice](MONETISATION.md).
