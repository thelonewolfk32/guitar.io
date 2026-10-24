# Guitar.io project guidance

The current user's approved V1.6 plan supersedes the earlier paid-cloud/advertising/Capacitor direction. Preserve all unrelated local work.

## Current source and platforms
- Published desktop version: 1.6.1, tag v1.6.1 at 26e97b6ec12f31cbfab9edd3e452e847cc7a4936. Windows/macOS 15/macOS 26 release checks and public V1.5.1/V1.6.0 updater detection passed; see VALIDATION-v1.6.1.md. Native/cloud deployment is separate.
- Desktop remains React/TypeScript/Vite and Electron 44.4.5, Node 24.
- The active Apple app is React Native 0.88.0 / React 19.3.0 under `mobile`, using bundle ID `io.guitario.mobile`.
- Run the iOS-first gates in IOS_FIRST_RELEASE.md and the steps in IOS_REACT_NATIVE_HANDOFF.md. `mobile/scripts/configure-ios.rb` connects the native modules, bundled score WebView before CocoaPods/Xcode builds. Use `--profile local` for free Personal Team signing; `--profile full` enables paid Apple capabilities. Never change bundle/team identity to bypass a signing error.
- The previous `ios/App` Capacitor project is retained for migration and reference. Do not overwrite or regenerate it.
- Mac desktop remains Electron. Do not imply the React Native iOS app is a replacement Mac desktop build.
- Keep mobile/node_modules, Pods, generated score assets, signing files and personal libraries out of Git and Source ZIPs.

## Product and privacy rules
- No advertising. Cloud and LAN sync, manual imports, manual sections and basic Learn are free.
- Temporary 23 October testing policy: Free permits 1,000 saved entries including pending music links; commercial baseline remains five. Keep shared/library-policy.mjs and the latest Supabase migration consistent. Free storage stays 150 MiB; Premium: unlimited song count within 1 GiB. Every new file is at most 30 MiB.
- Premium: automatic sections, synchronised YouTube, online enrichment/GP discovery and additional beta features. AUD 5/month or 50/year. Stem splitting has no active product or grant.
- Archived entries remain stored and exportable and count towards new additions. After downgrade the user chooses active entries; do not delete their originals or progress.
- Owner grants are independent of billing and audited. Admin endpoints require a verified owner role and MFA; never trust editable profile metadata for authorisation.
- Use official metadata APIs and GP candidate links. Automatic downloads require an authorised provider; existing legacy Songsterr transport code is not a commercial download licence.
- Feature usage is opt-in, aggregate and excludes song content, URLs, user IDs and persistent device IDs. Learning records and security/billing logs are separate account data.
- Never send service-role, webhook, Stripe secret, RevenueCat server or update-signing keys to a client, Git, logs or an artifact.

## Storage and compatibility
- Preserve the desktop guest DB `guitar-io-v1`, schema 4, and `guitario://app/` origin. Signed-in accounts use separate DBs.
- Preserve source bytes, IDs, field clocks, tombstones, per-peer checkpoints and pending transfers. Routine library reads stay metadata-only.
- Keep LAN V1.5 envelopes, verified six-digit pairing, private-address checks, encryption and byte verification. iOS is a foreground client.
- Mobile SQLite/app-private files own the library. The score WebView is a disposable rendering/editing workspace; no cloud credentials enter it.
- The one-time native migration reads the original WebKit `capacitor://localhost` origin, verifies record/byte counts and SHA-256, and retains original WebKit data and Keychain material for recovery.
- Preserve desktop updater save/sync draining, package verification, skipped-version installation and rollback. iOS uses TestFlight/App Store updates.

## Verification and release
Run relevant tests, desktop/admin/mobile typechecks and builds. Use isolated fixtures; never copy a personal profile between devices. Record current MIDI mixer patch results in VALIDATION-v1.6.2.md; retain earlier release evidence. The optional song midiMixer field must remain bounded/validated before merge, and survive unrelated edits. V1.6.2 is a candidate until publication is verified.
Native Swift compilation, signing, App Groups, real-device sound and Apple purchase validation must be reported separately from TypeScript/Metro/browser results.
The user has no Supabase project yet and requested the local setup package. Do not claim staging, live payments, private update hosting or TestFlight deployment is complete.
Published GitHub releases/tags are immutable. Source repository: https://github.com/thelonewolfk32/guitar.io.

- Cloud operations and private R2 recovery tooling are in CLOUD_OPERATIONS.md. On 22 October the owner explicitly authorised publishing the desktop update to repair PC/Mac/iPhone LAN sync, superseding the earlier desktop hold. See DESKTOP_SYNC_HANDOFF.md. No hosted restoration, new signing result or physical-device acceptance may be inferred from old CI.
