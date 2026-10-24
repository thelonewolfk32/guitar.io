# Current Guitar.io handoff — V1.6.2 MIDI mixer sync candidate

24 October: the iPhone now sends optional per-song `midiMixer` settings. V1.6.2 permits and validates that field before merge, with atomic invalid-page rejection and persistence regressions. See VALIDATION-v1.6.2.md. Build separate Windows/Mac production packages; V1.6.1 remains the published release until a new publication is verified. The iPhone-side schema is already updated; preserve its newer unshared working copy.

V1.6.2 candidates are built under `release/artifacts`, and the source is pushed in PR #3 (`codex/v1.6.2-midi-mixer-sync`). All 215 regressions pass locally; actual packaged Windows mixer/sync/restart/update/rollback checks pass. Desktop CI for code commit `75e1569c6bac75a70c49f5a4822d45b7e4a2bcd1` passed Windows and macOS 15/26, including mixer validation over encrypted LAN. No V1.6.2 tag or public auto-update has been published. See VALIDATION-v1.6.2.md for archive hashes and CI evidence.

23 October: user authorised the active-song catch-22 fix and a temporary 1,000-song testing allowance. See ACTIVE_SYNC_HANDOFF.md and VALIDATION-v1.6.1.md. Hosted quotas require the new migration/function; the newer iPhone working copy needs a targeted merge/rebuild.

V1.6.1 is published from `26e97b6ec12f31cbfab9edd3e452e847cc7a4936` after the owner's explicit normal-auto-update approval. Windows/macOS 15/macOS 26 tag checks passed. The public stable feed exposes complete Windows/Mac/Source downloads with verified checksum metadata, and the original V1.5.1 and V1.6.0 updater parsers detect the update on both supported desktop platforms. Both unsigned simulator profiles passed for that source; physical iPhone integration and hosted deployment remain separate. See VALIDATION-v1.6.1.md.

V1.6.0 is published from `0089ce43d01144a596076b0bd420f32a5fcbb572` through the normal updater. PR #1 is merged. Windows/macOS 15/macOS 26 release checks passed; the original V1.5.1 parser detects both verified downloads. See VALIDATION-v1.6.0.md for final evidence and the transient runner retry.

22 October 2026: the owner requested and explicitly authorised a normal desktop release for the build-161 LAN handoff. DESKTOP_SYNC_HANDOFF.md describes protocol-3 manifests, local file registration, durable queue repair and independent desktop hosting. This supersedes the earlier desktop hold below. Preserve the newer iOS work on the owner's Mac; this repository does not contain all those unshared changes.

Read AGENTS.md, MONETISATION.md, PC_SETUP.md, HOSTED_SERVICES.md, OWNER_SETUP.md, PRIVACY.md and IOS_REACT_NATIVE_HANDOFF.md.

The user approved free Supabase cloud sync, five saved entries on Free, Premium automation/YouTube/unlimited song count, no ads, React Native Apple development, teacher foundations, owner administration, feedback and opt-in aggregate usage.

The published V1.6.0 release includes the previously unpublished V1.5.2 deletion/onboarding/update/private-feed groundwork and the V1.6 implementation. Preserve prior fixes and private-data boundaries. Last previously published version was V1.5.1. See VALIDATION-v1.6.0.md for actual final verification and publication status.

Key changes:
- Shared capabilities/limits/expiry/grant sources; independent owner gifts and server-enforced song/storage limits.
- Account-separated desktop workspaces, active/archive selection, durable failed import drafts and pending shared-song entries.
- Foreground automatic cloud sync with complete GP/attachment downloads and retry queues.
- Explicit rhythm rendering and persistent section-colour preference.
- React Native mobile source, SQLite/files, Keychain, native bridges, migration, sharing, cloud/LAN clients and a bundled score workspace.
- Private owner web dashboard with MFA, gifts, extra limits, enterprise/beta eligibility, feedback and aggregate reports.
- Private learning event storage and future organisation/assignment/consent types; teacher dashboards and enterprise billing remain future work.
- Stripe/RevenueCat integration remains configuration-dependent. No live accounts, project, staging deployment or purchases have been created.

The user confirmed there is no Supabase project and requested the local setup package. Do not report hosted acceptance or an installable iOS build without actually completing those checks.

## iOS-first continuation (18 October 2026)
The first release gate is the owner's free-signing iPhone refresh. Read IOS_FIRST_RELEASE.md and the revised IOS_REACT_NATIVE_HANDOFF.md first. `--profile local` removes paid Apple capabilities; `--profile full` enables them after enrolment. Native Google/Apple plus Supabase Auth SDK/Keychain, desktop system-browser PKCE, recovery, full native/legacy backup restore, upload leases, seven-day GC, R2 recovery tooling, operational alerts and recent-auth/provider-revoked account deletion are prepared. Source packaging now points to React Native, not the retained Capacitor project.

No Supabase project exists. Provision Free staging first, then separate Pro production; Google/email precede full Apple/TestFlight. Use temporary owner Premium gifts before sandbox purchases. The R2/maintenance workflow is disabled until its protected environment/secrets and enable variable exist. Hosted restoration and physical iPhone checks are release gates, never inferred from local fixtures or unsigned CI. Keep the stable desktop release unpublished until after the iOS gates.
