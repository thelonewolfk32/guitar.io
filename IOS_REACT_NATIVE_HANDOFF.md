# Guitar.io V1.6 — React Native / Xcode Codex handoff

## Direction and current status
This handoff supersedes the older Capacitor, paid-cloud and advertising direction. The Apple application is now under mobile. Keep the existing `ios/App` project as migration/reference material. Mac desktop remains Electron.

User decisions: cloud sync free; five saved songs including pending links; 150 MiB Free / 1 GiB Premium / 30 MiB per new file; AUD 5 monthly / 50 yearly; no ads; basic Learn free; automatic sections, synchronised YouTube and online enrichment/GP discovery Premium. Downgrades preserve files and require active-song selection. Teacher tools stop at foundations.

Windows-verified: desktop and mobile TypeScript, Metro iOS JS bundle, owner build, shared/backend PostgreSQL checks, GP duration preservation and browser execution of the actual bundled score bridge. See VALIDATION-v1.6.0.md for final counts/results. The unsigned app and Share Extension compiled successfully on the GitHub Mac runner. Signing and device behaviour remain pending. configure-ios.rb sets both product names explicitly.

## Pinned source
- Node used locally: 24.19.0; project Node 24.
- React Native 0.88.0 / React 19.3.0.
- alphaTab 1.8.4; react-native-webview 14.0.1.
- OP-SQLite 18.2.5; react-native-file-access 4.0.4; react-native-keychain 10.0.0.
- RevenueCat react-native-purchases 10.14.0; documents picker 12.0.2.
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
APPLE_TEAM_ID=YOUR_TEAM bundle exec ruby scripts/configure-ios.rb
cd ios
bundle exec pod install
open GuitarIO.xcworkspace
```
The Ruby script is idempotent and adds native bridge sources, score resources, app entitlements and the embedded Share Extension. Enable the App Group for both App IDs in the developer account. Confirm a new App Store Connect build number before uploading; source defaults to version 1.6.0/build 160.

Unsigned simulator build:
```sh
xcodebuild -workspace GuitarIO.xcworkspace -scheme GuitarIO -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO ARCHS=arm64 ONLY_ACTIVE_ARCH=YES build
```
The GitHub mobile workflow performs these preparation/build checks on macOS. A simulator compile does not validate App Groups, purchased entitlements or physical-device sound.

## Architecture
- React Native owns library, account, import, Learn, sync, guitars and feedback screens.
- NativeRepository uses OP-SQLite and app-private content files with SHA-256 verification. Shared field-clock merging/tombstones remain compatible with desktop.
- The bundled ScoreWeb workspace reuses score editing, alphaTab notation/playback and fretboard Learn. It receives bounded, ordered message chunks and the selected song/attachments only. Native acknowledges saves before the editor reports success.
- The score workspace has no cloud credentials. Account changes recreate it. Pausing/navigation must stop playback; background sync is foreground/resume work.
- Native LAN adapts the previous Swift discovery/private HTTP validation and verified six-digit pairing. Shared crypto runs inside the bundled score engine. iPhone is a foreground client, not an always-on host.
- Apple IAP uses RevenueCat with the Supabase UUID. Configure one subscription group, entitlement `pro`, monthly/yearly products and the public Apple SDK key. Provider webhooks remain server-verified.
- Share Extension captures selected Spotify/YouTube/Apple Music links into an App Group inbox. Accepted entries count towards the song allowance. Rejected/full-library items remain in the inbox rather than disappearing.
- GP discovery presents candidate source pages and manual file attachment. Automatic downloads need an authorised provider.

## Migration — verify before retiring anything
GuitarPlatform opens the existing `capacitor://localhost` WebKit origin using the default website data store. It streams binary chunks to native files, hashes them, verifies record/byte totals and returns a metadata dump. Native migration copies raw IDs/settings/journals/field clocks and adopts verified originals/attachments before setting its completion marker.

Keep the installed app identity and signing team. Do not uninstall the old app first. Test original GP bytes, artwork, audio, edits, tuning, progress, guitars, folders, tombstones, device identity and pending transfers. Interrupt migration and retry. Verify restart/offline access. Original WebKit data and old Keychain entries remain available for recovery.

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
The user has no Supabase project yet. Finish local validation and hand over setup steps. Use HOSTED_SERVICES.md / OWNER_SETUP.md to configure staging before claiming cloud, live purchases or private updates are deployed. Do not embed secret keys or enable live charging as a shortcut.
