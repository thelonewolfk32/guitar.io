# Guitar.io

A guitar library and practice player for Windows and Apple Silicon Mac, with a React Native iPhone application under development.

**V1.6.1 fixes active-song syncing and temporarily allows 1,000 songs for testing.** See [downloads](https://github.com/thelonewolfk32/guitar.io/releases), [changes](CHANGELOG-v1.6.1.md), [validation](VALIDATION-v1.6.1.md) and the [desktop/iPhone handoff](ACTIVE_SYNC_HANDOFF.md). Hosted accounts and purchases require separate configuration.

## V1.6 model

Cloud and local sync are free. During testing, Free accounts save 1,000 songs or shared links (the intended commercial allowance remains five), with 150 MiB cloud storage. Premium adds unlimited song count within 1 GiB, automatic section suggestions, synchronised YouTube playback, online metadata/GP discovery and additional beta features, at AUD $5/month or $50/year. Files are at most 30 MiB. There are no advertisements.

Existing entries survive a downgrade: choose active songs in Account & plans; archived songs remain exportable and count towards additions. Manual GP import/editing, manual sections and Learn (beta) remain free. GP discovery opens source pages so users can choose an arrangement and supply their file.

V1.6 includes complete-file sync, account-isolated libraries, pending shared links, persistent import drafts, rhythm notation, a section-colour switch, guitar deletion, quiet Learn, an update ! indicator, feedback and opt-in aggregate usage. Owner administration supports independently audited gifts and allowances. Education models prepare for later teacher permissions and assignments.

## Test and setup

Windows: extract the full Windows ZIP and open Guitar.io.exe. Apple Silicon Mac: extract the Mac ZIP, run Prepare and open Guitar.io.command once, then open Guitar.io.app. Mac packages require local preparation and have not been notarised.

Application updates and personal library sync are separate. Help (?) → version number opens update controls. A ! appears when a newer published release is available. The existing GitHub updater remains configured; signed private Supabase update feeds are prepared as an alternative.

- [Programs and accounts to prepare](PC_SETUP.md)
- [Supabase staging and payments](HOSTED_SERVICES.md)
- [Owner dashboard setup](OWNER_SETUP.md)
- [Replacement React Native / Xcode handoff](IOS_REACT_NATIVE_HANDOFF.md)
- [Privacy and remaining launch requirements](PRIVACY.md)
- [Release and private updater guide](GITHUB_RELEASES.md)
- [Local sync](SYNC.md), [Mac desktop preparation](MACOS_BUILD.md)

From a source clone root with Node 24:

```sh
npm ci
npm test
npm run build
npm run admin:typecheck
npm run admin:build
npm ci --prefix mobile
npm run mobile:typecheck
npm run mobile:prepare
```

Use the React Native handoff for CocoaPods, Xcode, App Groups, legacy-library migration, sound, sharing and purchase tests. Keep the original Capacitor project for recovery; the new Apple app is under mobile. Native signing and physical-iPhone acceptance require a Mac and device.

Source repository: [thelonewolfk32/guitar.io](https://github.com/thelonewolfk32/guitar.io). Desktop downloads: [published releases](https://github.com/thelonewolfk32/guitar.io/releases/latest). Published tags and archives are immutable. Personal profiles, credentials and generated dependencies must stay out of source control.
