# V1.6 validation — 18 October 2026

Status: iOS-first local setup/source candidate. No Supabase project, live billing, signing, TestFlight or physical-iPhone acceptance exists yet. The stable desktop Release remains unpublished.

## Exact source and native CI

Branch: `codex/v1.6-free-cloud-react-native`, draft PR #1.

- iOS application source tested at `64a7169f70a9ec3e29c6be28dfeb3c5b77140ec4`: **local and full profiles both passed** unsigned arm64 simulator compilation, CocoaPods, mobile typecheck and idempotent local→full→local configuration tests. [iOS run 15](https://github.com/thelonewolfk32/guitar.io/actions/runs/39112172460).
- Windows checks below use the same `64a7169f70a9ec3e29c6be28dfeb3c5b77140ec4` implementation commit. [Desktop/package CI](https://github.com/thelonewolfk32/guitar.io/actions/runs/39112172439) also passed, including actual Windows updater checks and native Mac updater/local-signing smoke tests on macOS 15 and 26; the release/publish job was skipped. Documentation-only commits may follow.
- Recorded Mac toolchain: macOS 26.6.2 (25G83), Xcode 26.6 (17F113), iOS Simulator SDK 26.5, Node 24.21.0, Ruby 3.3.12, Bundler 2.5.22, CocoaPods 1.17.0, xcodeproj 1.28.1. The workflow prints tool versions. These are CI versions, not an asserted home-Mac setup.
- Native GoogleSignIn 10.0.0 uses modular GoogleUtilities 8.1.5 and RecaptchaInterop 101.0.0 for React Native static-library integration. QuickCrypto 1.1.8 / Nitro Modules 0.37.1 compile in both profiles.

An unsigned simulator success proves compilation. It does not prove Personal Team provisioning, App Groups, Google/Apple provider setup, retained iPhone data, sound output or purchases.

## Current Windows verification

Node 24.19.0, isolated synthetic fixtures; no personal library/profile was copied.

- **190 regression tests, zero failures.** Existing sync, notation, quotas, RLS, grants, education/analytics and updater tests remain included.
- New tests exercise exact/PKCE auth callbacks, recent AMR authentication, signout before SDK hydration, one-time legacy Keychain adoption, independent guest/account WebKit extraction without schema upgrades, and distinct native sharing constants/methods.
- Real source/attachment bytes stream through native backup export/restore. Corruption, truncation and missing references fail before metadata commit. Native migration uses actual repository code with SQLite/file adapters: an injected mid-transaction failure rolls back, retry preserves GP bytes, device ID, clocks, artwork and learned-section status, and the original source remains intact.
- PostgreSQL lifecycle tests cover leases, seven-day grace, archived reference protection, cleanup/reservation locking, owner/deletion authorisation, post-downgrade retention and bulk import rollback after a later page exceeds quota.
- Recovery-point fixtures verify hash/size checks, manifest-last publication, deduplication and 30-point selection. These are not a hosted database/R2 restore drill.
- Desktop, backend, owner/admin and React Native typechecks pass. Desktop/admin production builds, bundled offline score assets and the final Metro iOS JS bundle pass.
- Browser fixtures pass against the owner login/MFA/allowance/status/revocation/feedback/aggregate/operational-alert flows and the actual bundled score bridge (real GP inspect/chunks/hash/render/colour switch/free capability gate).
- A newly packaged isolated Windows build passes **actual download/install/force confirmation, direct V1.4.4-installer→V1.6 skipped-version restart, and startup failure rollback**. All preserve library cards, unrelated files, preferences and an OS-visible restart. A discovered legacy launch-before-result race is corrected by bounded/coalesced renderer-ready acknowledgement, including transient file-lock retries. The timing and lock cases have dedicated regression tests.

The previous V1.6 candidate also passed packaged guitar deletion/cancel/encrypted sessions/quiet Learn/update badge, archive selection/section controls, complete two-instance LAN GP/artwork/audio sync and offline restart, and musical-duration/rendering fixtures. Current desktop packaging CI reruns those checks. Desktop distribution remains a later release gate.

## Source kit and release artifacts

`scripts/package-ios.py` produces a commit-named **React Native source ZIP**, not an IPA, under `release/ios-first`. It includes the Xcode handoff, release gates and cloud recovery runbook, verifies ZIP CRCs and required source files, and excludes generated dependencies, personal libraries and signing/settings secrets. Prepare assets/Pods on the Mac as documented.

Existing local desktop candidate archives can predate this iOS-first revision. Do not upload those stale candidates. At release gate 7 use clean successful CI artifacts for the reviewed commit, verify checksums and both platform ASARs/source, then publish through the existing updater workflow. No stable tag/Release was created here.

## Pending external acceptance

- Personal Team signing continuity and full pre-install legacy JSON/container backup; physical-phone in-place migration, interrupted migration, restoration, speaker/headphone MIDI, airplane mode, score display and resume.
- Free Sydney staging deployment, SMTP/redirect/provider configuration and MFA owner; actual-byte direct Storage requests, simultaneous quota/import tests, two real accounts/devices, complete GP/artwork/audio, restart/offline access and account switching.
- Google/Apple/email linking and recovery, all three native Share Extension sources, cancellation, full libraries and wrong/unavailable GP matches on real devices.
- Account deletion with recent credentials, linked-provider revocation, deferred/failed cleanup and deleted-user suppression in a real restore.
- Separate Pro production, private R2 scheduler/credentials, a successful database-and-original-file restore drill, monitoring thresholds and provider billing reconciliation.
- Full Apple capabilities, internal TestFlight and nongifted RevenueCat/Stripe sandbox purchase/restore/expiry/cancellation/duplicate prevention; no live charging is enabled.
- Published privacy/support pages and accurate App Store disclosures; feedback attachment consent and analytics opt-out on devices.
- App Store submission, then production desktop social login, Mac signing/Gatekeeper and final stable updater release.

Use IOS_REACT_NATIVE_HANDOFF.md, HOSTED_SERVICES.md, CLOUD_OPERATIONS.md and IOS_FIRST_RELEASE.md. Pending evidence never means passed. Staging users/credentials/grants are not copied to production.
