# V1.6 iOS-first release gates

On 22 October 2026 the owner authorised a normal desktop V1.6 update to fix PC/Mac/iPhone LAN file replication before the remaining hosted/iOS gates. That explicit exception supersedes the previous desktop publication hold; it does not certify cloud, purchases or physical iPhone acceptance. See DESKTOP_SYNC_HANDOFF.md. The repository version is not evidence of distribution. Staging users, credentials and grants are never copied into production. Export/import wanted test libraries instead.

| Order | Milestone | Work prepared in source | Evidence needed to advance |
|---|---|---|---|
| 1 | Own iPhone, free Personal Team | `--profile local`, original identity, migration, native full backup/restore, offline score/soundfont | Verified legacy export and Xcode container before installing; in-place migration, hashes, interruption/restart and audible MIDI on the physical phone |
| 2 | Free Sydney staging | Migrations, free cloud, Google/email, account linking, actual-byte/quota test script, owner gifts | Create `guitario-staging` in a Free organisation; SMTP, provider/redirect setup, MFA owner; phone/desktop complete-file sync, offline access and isolated account tests |
| 3 | Full Apple capabilities | `--profile full`, Apple login, App Group and Share Extension | Paid Developer Program; verify team continuity before replacing local app; three share sources, offline inbox, full libraries and Apple private-email linking |
| 4 | Internal TestFlight | RevenueCat account UUID binding, restore and duplicate prevention | Configure sandbox products/webhook; use separate nongifted accounts for purchase/expiry/cancellation tests |
| 5 | Production readiness | R2 daily recovery tooling, 30 daily points, cleanup, operational alerts, deletion and consent | Separate Sydney `guitario-production` in a Pro organisation; restore both DB and object bytes into isolated recovery; hosted quota/concurrency/deletion tests; privacy/support pages and accurate App Store disclosures |
| 6 | iOS App Store | Production-connected TestFlight candidate | Physical-device migration, playback, sharing, cloud, identity and purchases signed off on the exact submitted commit/build |
| 7 | Desktop stable update | System-browser Google/Apple PKCE support; existing verified GitHub updater | Production provider configuration and Windows/Mac OAuth checks; v1.5.1 skipped-version update/rollback acceptance; publish both platform archives together |

## Evidence register

For each row record: commit SHA, app version/build, date, tester, platform/device/OS, profile, Supabase project reference, public build settings, exact command, result and recovery evidence. Keep personal libraries, tokens and signing material out of this register and Git.

Use `VALIDATION-v1.6.0.md` for executed Windows/Mac CI checks. Use `IOS_REACT_NATIVE_HANDOFF.md` for the phone procedure and `CLOUD_OPERATIONS.md` for backups/restoration. Empty or pending evidence never means passed.

### Physical iPhone acceptance sheet

- [ ] Legacy export includes all GP/artwork/audio; old Xcode app container downloaded and bundle/team recorded.
- [ ] In-place local-profile migration preserves record counts, original hashes, edits, progress, guitars, folders, device identity, tombstones and checkpoints.
- [ ] Interrupted migration retries; restart and airplane mode retain all required bytes; original WebKit/Keychain remains recoverable.
- [ ] Speaker/headphones play MIDI audibly; interruptions and resume behave correctly; Tab/Notation/Both, rhythm symbols and section colours work.
- [ ] Native backup restores into an empty fixture library; legacy JSON export restores; damaged/truncated backups leave the destination unchanged.
- [ ] Google/Apple/email, explicit linking, private Apple email, recovery, cancellation and account switching keep libraries isolated.
- [ ] Active GP/artwork/audio fully downloads; interrupted transfers resume; source-missing and quota failures stay visible.
- [ ] Five slots across simultaneous devices, pending conversion, archive selection, storage retention and temporary owner gifts work.
- [ ] Spotify/YouTube/Apple Music shares survive offline capture/restart, duplicates and full libraries.
- [ ] Nongifted sandbox accounts purchase/restore; duplicate subscriptions are prevented; expiry/revocation preserves independent gifts.
- [ ] Account deletion requires recent authentication, revokes linked providers, removes account files, and survives failed cleanup. User cancellation stops uncommitted deletion.
- [ ] Feedback attachments require selection; analytics opt-out clears unsent counts. Owner routes require role plus MFA.
- [ ] Production backup plus restore drill verifies DB state and original bytes; deletion ledger prevents restoring deleted users.

No hosted project exists yet. Provisioning, paid enrolment, physical-phone checks and App Store submission require the owner's accounts/devices. They are not completed by local tests.
