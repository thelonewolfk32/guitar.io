# Guitar.io 1.5.2 validation

Source baseline: 8b05f921dd374125b8b0bf90f52402b43ba7622f (published V1.5.1), plus the local V1.5.2 candidate. Prepared on Windows, 14 October 2026. Node.js 24.19.0; Electron 44.4.5; Capacitor 8.5.2. No V1.5.2 release is published.

Verified:

- Full serial suite: 164 passed, 0 failed. One further signed-feed migration/coalescing/cache test passed after that run; the current suite contains 165 cases. Targeted account/cloud checks were rerun after the final concurrency guard change.
- Frontend and backend TypeScript checks, Electron JavaScript syntax, production build and Capacitor asset/plugin sync. Native copying does not compile/sign Swift.
- Embedded PostgreSQL migration and actual row-level storage policies: authenticated free users cannot access paid cloud, accounts cannot read/write another account’s files, clients cannot write billing grants or invoke privileged merge RPCs, revision CAS preserves cursors, event replays/older events cannot revive expired grants, independent purchase sources remain valid, and the storage quota is enforced.
- Cloud transport fixtures: genuine synthetic Guitar Pro bytes and attachment persistence, offline score reads, durable pending upload retry after metadata acknowledgement, and no repeated bytes on an unchanged sync. The audio fixture tests byte transport, not audio decoding.
- Stripe signature/body/timestamp verification, period-end cancellation/expiry handling, RevenueCat entitlement expiry, AUD prices and conservative ad opportunity rules. These use isolated fixtures, not live provider accounts.
- Signed update manifests: Windows/Mac selection, tampering, expiry, other download hosts, server-generated manifests and migration away from a previous GitHub cache.
- Real Windows app, development and packaged: guitar Delete/Keep UI, original scores/other associations retained, encrypted OS session storage and clear, AUD plan preparation, visible update ! before download, 393 x 852 header without overflow, and quiet Learn beta. Screenshots inspected.
- Packaged V1.5.2 complete-file LAN sync: GP/audio/artwork, multi-chunk attachment, cache reuse, legacy missing-file repair and restart/offline score opening.
- Packaged Windows updater manual/force, skipped V1.4.4 replacement and failed-startup rollback: all three passed with saved library/unrelated files preserved and visible native restart.
- Production dependency audit: zero reported advisories on this lockfile, 14 October 2026. Development dependencies are not included in the desktop app’s runtime payload.

Pending: hosted Supabase/SMTP/Storage/Stripe/RevenueCat integration, automatic cloud scheduling and operational launch gates in HOSTED_SERVICES.md; actual macOS launch/Gatekeeper/playback; Swift compilation/signing and native Keychain; iPhone purchases/restore, privacy/ads, foreground cloud transport, audible MIDI and hidden-scrollbar device checks. No live billing/ad SDK or deployment is represented as complete.

Candidate archives use the existing pinned-runtime packaging scripts. Run scripts/verify-release.py against the generated checksums/archives before distribution.
