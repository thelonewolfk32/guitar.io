# V1.6 validation — 17 October 2026

Status: local setup/test candidate. No Supabase project or live billing deployment exists. Native device acceptance remains pending.

## Passed locally on Windows
- 175 regression tests, zero failures (Node 24.19.0). This includes embedded PostgreSQL migrations, atomic simultaneous song reservations, free cloud access, quotas, downgrade retention, grant expiry/revocation, RLS/tenant isolation, owner MFA rejection, sharing identities, offline drafts and account workspaces.
- Desktop, backend, owner dashboard and React Native TypeScript checks.
- Desktop and owner production builds; React Native iOS Metro JavaScript bundle and bundled score asset generation.
- Packaged Windows UI: guitar deletion/cancel preserves original scores, OS-encrypted sessions, AUD pricing, update !, narrow header, quiet Learn (beta).
- Packaged V1.6 UI: choose five active entries after downgrade, archived opening blocked, persistent section colours, free automatic-sections restriction, over-limit GP retained as an exportable/retryable draft.
- Two packaged Windows instances: encrypted LAN sync transfers actual GP/artwork/audio, multi-chunk audio, no-change reuse, metadata-only repair, restart and offline score access.
- Actual Windows updater: download/install separation, force confirmation, skipped-version install from V1.4.4, visible relaunch, startup failure rollback, original library and unrelated files retained.
- Bundled score WebView bridge in headless Edge: GP inspection, ordered binary chunks, checksum verification, render, colours and capability checks. Visually inspected notation stems/beams and the owner UI.
- GP quarter/dotted/eighth/sixteenth notes, rests, ties and tuplets survive editing/export. Tab, Notation and Both render without changing durations.
- Owner browser fixture: login/MFA session, account selection, gifts/allowances with a reason, suspension/restoration, independent revocation, feedback and aggregate counts.

## Artifacts
The local package scripts produce Guitar-io-1.6.0-Windows-x64.zip, Guitar-io-1.6.0-macOS-arm64.zip and Guitar-io-1.6.0-Source.zip, plus Guitar-io-1.6.0-SHA256SUMS.txt. Run scripts/verify-release.py to verify SHA-256, ZIP CRCs, matching desktop ASARs and current source. Mac archive construction on Windows does not establish native Mac execution/signing.

## Pending external acceptance
- Supabase staging deployment, two real accounts/devices, bucket policies, hosted failures and account switching.
- Stripe/RevenueCat sandbox purchase, restore, cancellation, expiry and cross-provider subscription checks; live payments remain disabled.
- Real provider metadata/Brave requests and all three provider app share workflows.
- Xcode/Swift compile, signing, App Groups, legacy-library migration, native SQLite/files/LAN, audible speaker/headphone MIDI and purchases on a physical iPhone. Mac desktop user-session/Gatekeeper checks.
- TestFlight/App Store submission, published privacy policy/account-deletion lifecycle and orphan-storage cleanup before public launch.

GitHub workflows are prepared for desktop packages/Mac updater and an unsigned iOS simulator compile. Consult their actual results; source presence or a Metro bundle is not an iOS compilation result. Stable V1.6 publication is deferred until staging acceptance.
