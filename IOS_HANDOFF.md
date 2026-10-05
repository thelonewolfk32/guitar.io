# Guitar.io V1.4.1 — iOS build handoff

## Deliverable and user constraints

The iOS Project ZIP contains an actual Xcode project, native Swift LAN plugin and the current production app with offline notation/fonts/soundfont. It is not an IPA. Windows cannot run Apple's iOS compiler or signing tools. The Source ZIP contains all React/TypeScript, Electron, protocol, tests and rebuild scripts.

User's MacBook is Apple Silicon; no paid Apple Developer membership yet. Do not claim an App Store/TestFlight-ready binary or continuous iOS background execution. No GitHub changes/publication. Preserve the real library, app origins and pairing keys; test with isolated synthetic data. Export a backup before real-device upgrades.

## Build directly in Xcode

1. Extract Guitar-io-1.4.1-iOS-Project.zip on the Mac. No Node is needed to compile its supplied web assets.
2. Install current Xcode (Capacitor 8.5.2 requires Xcode 26 or newer). Open `ios/App/App.xcodeproj`; Xcode resolves Capacitor 8.5.2 with Swift Package Manager. Deployment target is iOS 16.0.
3. Select App > Signing & Capabilities > your Apple ID's Personal Team, with automatic signing. Use a unique bundle identifier if Apple's signing system requires it. Keep the IndexedDB name and storage origin unchanged.
4. Connect/trust your iPhone and enable Developer Mode if requested. Select the device and Run. Simulator compilation does not need a provisioning team.
5. Allow Local Network access. On a V1.4 PC/Mac, open Device sync, enable Local sync, copy the six-digit device code. On iPhone enable Local sync, choose Add device, enter that code and compare the verification digits. Confirm Digits match on both devices. Pair every desktop the phone should reconcile directly.
6. Personal Team is for your own development testing and may require re-signing. App Store/TestFlight distribution later needs paid membership and App Store Connect. Produce the signed IPA on the Mac with the appropriate profile; do not fabricate certificates or self-sign after installation.

## Rebuild after source edits

Extract Source ZIP, install Node 22+, then from `guitar-io`:

```sh
npm ci
npm test
npm run ios:sync
npm run ios:open
```

Do not run `cap add ios` again. `cap sync ios` refreshes assets/managed SPM package while preserving the custom Swift sources. Both native Swift files are included in the Sources build phase. SceneDelegate and storyboard use GuitarViewController, which registers GuitarLocalPlugin.

Optional unsigned simulator compile:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath build/ios-simulator CODE_SIGNING_ALLOWED=NO build
```

For device archives set the team in Xcode and use Product > Archive; let Xcode manage provisioning.

## Architecture and invariants

- `src/storage.ts`: IndexedDB `guitar-io-v1`, schema 4. One-time journal indexing retains the V1.3 device ID; immutable songSources/assets, lightweight songIndex and individual save journaling remain. Do not scan/parse GP files at startup or during routine sync.
- `src/sync-model.ts`: cumulative per-entity fields and map keys, plus tombstones. Conflict order is logical UTC timestamp, stable device ID, origin sequence. Unrelated fields merge; same-field offline conflicts use deterministic last-write-wins. Persisted logical clock advances beyond observed edits. Automatic system date/time is needed for the encrypted request's two-minute expiry window.
- `src/sync-storage.ts`: revision-indexed delta pages, atomic apply/checkpoint, derived metadata summaries, missing-file descriptors and temporary chunk storage. Compact diagnostic history can be discarded while cumulative current state/tombstones still serve long-offline peers.
- `src/lan-sync.ts`: per-peer pull/push checkpoints, pair-once keys, background checks while app is open, save/reconnect/foreground triggers, bounded pages and lazy content fetching. Incoming edits wait until the library to avoid disrupting an active player/editor.
- `shared/lan-crypto.mjs`: AES-256-GCM with fresh 96-bit nonces, protocol AAD and response/request identity binding. Pairing codes contain private keys; never publish them or include them in test results. No secrets are exported in song backups.
- `electron/lan-service.mjs`: private IPv4 HTTP carrying encrypted messages, `_guitario._tcp` Bonjour discovery/advertisement, no public or redirected targets, replay/expiry checks. build-lan.mjs bundles runtime dependencies into lan-bundle.cjs for ASAR.
- `ios/App/App/GuitarLocalPlugin.swift`: native URLSession LAN requests with cellular/expensive/constrained access disabled, private IPv4 validation, Bonjour discovery and narrowly allowed HTTPS Songsterr JSON downloads. Native requests avoid WKWebView CORS without weakening CSP. Gzip JSON uses zlib and a 30 MiB output bound.
- iOS is a bidirectional client of paired desktop hosts. It is not a permanently listening server. It syncs foregrounded and catches up after resume; no unsupported background mode is declared. Direct iPhone-to-iPhone hosting and IPv6-only LANs are not implemented.
- Catalogue bootstrap includes metadata/sections/note edits/IDs, not original GP/audio bytes. Artwork loads as visible cards ask for it. GP/audio download when opened; cached bytes play offline. Uncached content requires an awake paired peer that has the bytes.
- iOS keeps `capacitor://localhost`; Electron keeps `guitario://app/` and its existing Guitar.io profile. Device identities are independent. Do not change these during upgrades.
- No router port forwarding, cloud account, perpetual iOS background process or full-library exit save. A later cloud adapter can reuse these transport-independent deltas/clocks/content references.

## Required Mac/iPhone checks

1. Compile simulator and physical-device targets; fix Swift/SDK issues in place. This Windows host cannot verify Swift, WebKit audio or provisioning.
2. Verify plugin registration, Local Network permission (allow/deny/re-enable), discovery and Wi-Fi IP changes. Allow local desktop firewall connections if prompted. Guest Wi-Fi isolation can block peers on the same SSID.
3. Pair with Windows and Mac; test cold start/resume, offline edits on all three, different-field merges, newest same-field wins, repeated delivery and restarts. Unchanged reconnects must not re-fetch catalogue.
4. Verify sections/progress, recent activity, notes/tempo/tuning, splice/Undo, folders/guitars and attachment references. Delete a song and reconnect an offline peer without resurrection.
5. Verify untouched GP/audio are not transferred before opening. Interrupt/resume a download, then reopen offline. Check Stories/full MIDI on 44.1/48 kHz outputs, correct tuning/BPM and touch audio unlocking.
6. Test public YouTube playback/sync/referrer behaviour in WKWebView. Test native file import and export/backups; a native Share/file export adapter may be needed if WebKit ignores browser download links.
7. Visually check portrait/landscape iPhone, iPad, safe areas, player/settings/section editing/Splicer. Browser phone viewport verification does not replace native tests.
8. Confirm cellular-only sends zero LAN requests, suspension/resume catches up, idle head checks stay small, and data counter increases only for actual encrypted requests.

See VALIDATION-v1.4.1.md for completed Windows checks. Deliverables: Windows x64 ZIP, Apple Silicon ZIP with prepare command, iOS Project ZIP, Source ZIP and SHA256SUMS. Native Mac/iOS verification remains pending until performed on the MacBook.

References: [Capacitor requirements](https://capacitorjs.com/docs/getting-started/environment-setup), [Apple device workflow](https://help.apple.com/xcode/mac/current/en.lproj/dev3e2f4ee6d.html), [Apple local network privacy](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy).

## V1.4.1 native follow-up

Verify six-digit discovery (including code resets and IP changes), P-256/HKDF WebCrypto support, matching verification digits on iPhone and host, Auto sync off/on persistence and manual Sync now. iOS remains a desktop client and does not advertise a host code. Test the new bar offset slider, supported YouTube BPM/% choices, section speed changes at sync boundaries, minimized video continuity, MIDI count-in and adjustable 100% zoom on WebKit. The song tempo editor is intentionally removed; saved/imported tempo data is retained. Native compilation, signing and device testing are still pending on the Mac.
