# Current Guitar.io handoff — V1.6

Read AGENTS.md, MONETISATION.md, PC_SETUP.md, HOSTED_SERVICES.md, OWNER_SETUP.md, PRIVACY.md and IOS_REACT_NATIVE_HANDOFF.md.

The user approved free Supabase cloud sync, five saved entries on Free, Premium automation/YouTube/unlimited song count, no ads, React Native Apple development, teacher foundations, owner administration, feedback and opt-in aggregate usage.

The working tree includes the earlier unpublished V1.5.2 deletion/onboarding/update/private-feed groundwork and the new V1.6 implementation. Preserve prior fixes and private-data boundaries. Last previously published version was V1.5.1. See VALIDATION-v1.6.0.md for actual final verification and publication status.

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
