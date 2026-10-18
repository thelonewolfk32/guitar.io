# Guitar.io V1.6 — React Native / Xcode Codex handoff

## Direction and current status
This handoff supersedes the older Capacitor, paid-cloud and advertising direction. The Apple application is now under mobile. Keep the existing `ios/App` project as migration/reference material. Mac desktop remains Electron.

User decisions: cloud sync free; five saved songs including pending links; 150 MiB Free / 1 GiB Premium / 30 MiB per new file; AUD 5 monthly / 50 yearly; no ads; basic Learn free; automatic sections, synchronised YouTube and online enrichment/GP discovery Premium. Downgrades preserve files and require active-song selection. Teacher tools stop at foundations.

Start with the owner's iPhone using **free Personal Team signing**. Only after its migration/playback gate passes should staging and the paid Apple capabilities follow. See IOS_FIRST_RELEASE.md for the required order.

Windows checks and Mac CI are recorded separately in VALIDATION-v1.6.0.md. The preceding source commit `6a6287b` compiled on the Mac runner. New profiles/native authentication dependencies must pass their own CI; previous success is not evidence for changed native code. No signing, physical-device sound or hosted deployment has been claimed.

## Pinned source
- Repository: https://github.com/thelonewolfk32/guitar.io; branch `codex/v1.6-free-cloud-react-native` (draft PR #1). iOS-first implementation starts at `fc6caa8c8d2484df46a8fc5ea138e84d04219a98`; use the latest tested commit recorded in VALIDATION-v1.6.0.md, not the old desktop download.
- Node used locally: 24.19.0; project Node 24.
- React Native 0.88.0 / React 19.3.0.
- alphaTab 1.8.4; react-native-webview 14.0.1.
- OP-SQLite 18.2.5; react-native-file-access 4.0.4; react-native-keychain 10.0.0.
- RevenueCat react-native-purchases 10.14.0; documents picker 12.0.2.
- Supabase JS 2.118.0; native GoogleSignIn CocoaPod 10.0.0. Native QuickCrypto 1.1.8, Nitro Modules 0.37.1 and UTF-8/URL support initialise before the account SDK, so PKCE uses SHA-256 in Hermes.
- Gemfile: Ruby 3.3+, CocoaPods 1.17.0, xcodeproj 1.28.1. These versions were verified by the remote Mac setup/build; no Mac runs locally on this Windows PC.
- Remote CI setup/unsigned compile verified: macOS 26.6.2, Xcode 26.6 (iOS Simulator SDK 26.5), Node 24.21.0, Ruby 3.3.12, CocoaPods 1.17.0 and xcodeproj 1.28.1. [Successful Mac job](https://github.com/thelonewolfk32/guitar.io/actions/runs/39018382116/job/117355065615). This is a simulator build, not a signed device result.
- Original app icon copied from the existing Apple project.
- Bundle ID `io.guitario.mobile`; scheme GuitarIO; App Group `group.io.guitario.mobile`; Share Extension `io.guitario.mobile.share`.

## Mac setup and build
Use a compatible current Xcode/macOS combination for pinned React Native; record `xcodebuild -version`, macOS version, Ruby, Bundler and CocoaPods before testing. Do not claim a working IPA from a Windows bundle.

From repository root:
```sh
npm ci
npm ci --prefix mobile
npm run assets
npm run mobile:prepare
npm run mobile:typecheck
cd mobile
bundle install
APPLE_TEAM_ID=YOUR_PERSONAL_TEAM bundle exec ruby scripts/configure-ios.rb --profile local
cd ios
bundle exec pod install
open GuitarIO.xcworkspace
```
Open the workspace, select the **GuitarIO** scheme, choose your connected iPhone and your existing Personal Team under Signing & Capabilities. Confirm the identifier is `io.guitario.mobile`. Use Release on the phone when checking bundled offline sound/assets; Debug normally depends on Metro. Source defaults to 1.6.0/build 160; choose an unused build number before TestFlight upload.

The idempotent Ruby script supports these two profiles; rerun it before `pod install` whenever switching:

| Profile | Signing | Capabilities |
|---|---|---|
| `local` (default) | Existing free Personal Team | No extension target/embed, App Group entitlement or Apple sign-in. Local practice, migration, backups and foreground LAN remain available. Google/email work after their staging setup. Apple purchases are hidden. |
| `full` | Paid Developer Program | Main app App Group + Apple sign-in; Share Extension with its own App Group entitlement; purchase UI. Configure App Groups on both App IDs and Sign in with Apple on the main App ID. |

Native capability constants control JS visibility and inbox access. A local build never calls the App Group inbox. Neither profile changes the main bundle ID or migrates storage by changing identity. Free signing has provisioning limits/expiry; rebuild/re-sign through Xcode as needed. [Apple account capabilities](https://developer.apple.com/help/account/basics/about-your-developer-account).

Once enrolled, verify signing continuity and backups **before** changing teams, then run:
```sh
APPLE_TEAM_ID=YOUR_PAID_TEAM bundle exec ruby scripts/configure-ios.rb --profile full
cd ios
bundle exec pod install
open GuitarIO.xcworkspace
```
`bundle exec ruby scripts/check-ios-profiles.rb` checks local→full→full→local→local transitions and identity/entitlement/embed behaviour. CI compiles each profile independently. This test leaves the project local; explicitly select full afterward when needed.

Unsigned simulator build:
```sh
xcodebuild -workspace GuitarIO.xcworkspace -scheme GuitarIO -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```
The GitHub mobile workflow performs these preparation/build checks on macOS. A simulator compile does not validate App Groups, purchased entitlements or physical-device sound.

## Architecture
- React Native owns library, account, import, Learn, sync, guitars and feedback screens.
- NativeRepository uses OP-SQLite and app-private content files with SHA-256 verification. Shared field-clock merging/tombstones remain compatible with desktop.
- The bundled ScoreWeb workspace reuses score editing, alphaTab notation/playback and fretboard Learn. It receives bounded, ordered message chunks and the selected song/attachments only. Native acknowledges saves before the editor reports success.
- Native score opening prepares AVAudioSession in playback/mix mode; leaving/backgrounding pauses the engine and releases the session. This targets audible foreground MIDI, including silent-switch behaviour, but speaker/headphone and interruption checks remain physical-device gates. The score workspace has no cloud credentials. Account changes recreate it. Pausing/navigation must stop playback; background sync is foreground/resume work.
- Native LAN adapts the previous Swift discovery/private HTTP validation and verified six-digit pairing. Shared crypto runs inside the bundled score engine. iPhone is a foreground client, not an always-on host.
- Apple IAP uses RevenueCat with the Supabase UUID. Configure one subscription group, entitlement `pro`, monthly/yearly products and the public Apple SDK key. Provider webhooks remain server-verified.
- Share Extension captures selected Spotify/YouTube/Apple Music links into an App Group inbox. Accepted entries count towards the song allowance. Rejected/full-library items remain in the inbox rather than disappearing.
- GP discovery presents candidate source pages and manual file attachment. Automatic downloads need an authorised provider.

## Migration — verify before retiring anything
Before installing on the existing phone:
1. In the old app export a **full JSON backup with MP3s and artwork included**. Copy it to the Mac and keep an untouched copy. Verify every expected GP and attachment is represented. A lightweight export is insufficient.
2. In Xcode → Window → Devices and Simulators, select the connected iPhone and installed app, then **Download Container**. Preserve the `.xcappdata` privately. This container is a recovery copy; it is not proof that Keychain access will survive a team change.
3. Record the installed bundle identifier, signing team/application identifier, old version, counts of songs/assets and example hashes/progress. Use the existing signing/provisioning record and installed app information. If you cannot establish the team, stop before replacing the app.
4. Keep the same bundle ID and signing team and install over the existing installation. **Do not uninstall first.** If Xcode requires a different identity/team, verify backup restoration on a separate fixture install before replacing anything. Do not work around signing errors by changing the identifier.

GuitarPlatform opens the existing `capacitor://localhost` WebKit origin using the default website data store. It streams binary chunks to native files, hashes them, verifies record/byte totals and returns a metadata dump. Guest and signed-in WebKit databases are extracted into their corresponding native scopes; guest content is never implicitly copied into an account. Native migration stages raw IDs/settings/journals/field clocks in an in-memory database, verifies/copies all required originals and attachments, then commits metadata and its marker in one SQLite transaction. Older WebKit schemas are read without upgrading them.

Keep the installed app identity and signing team. Do not uninstall the old app first. Test original GP bytes, artwork, audio, edits, tuning, progress, guitars, folders, tombstones, device identity and pending transfers. Interrupt migration and retry. Verify restart/offline access. Original WebKit data and old Keychain entries remain available for recovery.

Account → **Export verified library backup** creates a chunked `.guitariobak` including originals, attachments, drafts, edits and learning records. Export fails if required bytes are missing. Restore accepts this format and the existing legacy JSON export, verifies files before committing metadata, and requires an empty destination. It does not overwrite another library. Account restore reserves slots on the server; over-allowance backups remain intact for export until an owner grant/Premium allows restoration. Cloud/LAN stay paused after restore. Native backups omit credentials/pairing secrets; re-pair LAN. These files contain private library content: keep them outside Git.

## Staging accounts, providers and callbacks

No project exists yet. Create **guitario-staging**, Sydney, in a Free organisation. Use HOSTED_SERVICES.md, then OWNER_SETUP.md. Production later uses a separate Pro organisation/project; never copy staging identities/grants/secrets into production.

Put public staging URL/key in `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_ACCOUNTS_ENABLED=true`), then run `npm run mobile:prepare` again. These public values alone do not activate billing. Configure email confirmation, SMTP and manual identity linking on Supabase. Exact redirect allowlist:
```text
io.guitario.mobile.auth://callback
http://127.0.0.1:43871/auth/callback
```
The SDK may append a per-request `sb_flow_id`; preserve it through email/provider redirects. Use the standard Supabase confirmation/recovery templates (`ConfirmationURL`) for PKCE. Open these emails on the initiating device while the app remains installed; after a reinstall or on another device, request a fresh link. The callback also recognises explicitly configured one-use `token_hash` signup/recovery/email links. It rejects implicit bearer-token fragments, foreign paths and invalid flow IDs.

For Google, create Web and iOS OAuth clients in Google Auth Platform. The iOS client uses the original bundle ID. Enable Google in Supabase with the **Web client ID first**, followed by the native client ID, and the Web secret server-side. Scopes are openid/email/profile only. Run before configuring/pod install:
```sh
export GOOGLE_IOS_CLIENT_ID='YOUR_IOS_ID.apps.googleusercontent.com'
export GOOGLE_WEB_CLIENT_ID='YOUR_WEB_ID.apps.googleusercontent.com'
APPLE_TEAM_ID=YOUR_EXISTING_TEAM bundle exec ruby scripts/configure-ios.rb --profile local
```
The script writes public client IDs and the reversed Google URL scheme into Info.plist. Credentials are returned by the native Google SDK and exchanged with Supabase Auth. Do not add Google client secrets to mobile config. [Supabase Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

Apple login appears only in full builds. Enable its native bundle ID in Supabase's Apple provider and the developer account. Configure server-only Apple team/key/private-key settings for token revocation; no Apple private key goes in Xcode sources. Native login requests email/name, saves the name when supplied on the first authorisation, and uses a nonce. Desktop Apple OAuth additionally needs its Services ID, callback and maintained client secret. [Supabase Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple).

“Link Google/Apple account” operates while authenticated and requires the same Supabase UUID on return. Apple private email is handled as an identity; no local merge uses displayed email addresses. Libraries, gifts and RevenueCat use that UUID. Keychain retains SDK/session state, outside the score WebView.

Recovery callbacks open Account with a new-password form. Signing out clears native SDK/session credentials and pending PKCE verifiers, and changes library scope. Legacy credentials are adopted only once per configured service; logout prevents automatic re-import while the original Keychain entry remains available for deliberate recovery. Account deletion requires typing DELETE, fresh provider/password authentication within five minutes and server-verified provider revocation. The durable cleanup queue removes private cloud objects/account relations; the phone removes its account file directory. Cancellation before committed deletion cancels the pending request. Delete retries never recreate subscriptions. Explain that subscription cancellation remains a separate Apple/Stripe action. Backups expire under the 30-point retention policy; the deletion ledger is applied during disaster recovery.

## Required Mac/iPhone acceptance
1. Native compile and both app/extension targets, signing, clean install and in-place update.
2. Real-device migration with synthetic copies of all supported legacy records and large attachments; no personal files in Git/logs.
3. GP import, offline playback, audible MIDI through speaker/headphones, interruptions and background/foreground behaviour.
4. Shared links from all three provider apps, duplicate handling, a full library, disabled network and app restart.
5. Free cloud between phone/Mac/PC with complete files and attachments; interrupted download/upload; account switching and logout.
6. Six-digit LAN verification, wrong digits, private-address rejection, complete GP/audio/artwork transfer, restart/offline access.
7. Free limit, pending-to-score conversion, archived access/export and active selection; owner gifts and storage increases.
8. Sandbox purchases, restoration, duplicate prevention, cancellation/expiry and account identity changes.
9. Quarter/dotted/eighth/sixteenth notes, rests/ties/tuplets; Tab/Notation/Both; section colours on/off and dark mode.
10. Feedback attachment consent and analytics opt-in/out; App Store privacy disclosures and account-deletion lifecycle before public launch.

## Service prerequisites
The user has no Supabase project yet. The package includes all migrations, isolated hosted test tooling and a disabled managed operations workflow. Follow HOSTED_SERVICES.md, CLOUD_OPERATIONS.md and OWNER_SETUP.md to configure staging, R2 and production. Do not claim a cloud deployment, tested Apple purchase or phone installation from source/CI alone. Keep the stable Windows/Mac GitHub Release unpublished until IOS_FIRST_RELEASE.md's gates pass.
