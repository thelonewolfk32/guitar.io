# Guitar.io React Native Apple app

This is the replacement iOS application, using bundle ID `io.guitario.mobile`. The older `ios/App` project is retained for migration/reference.

Start with `IOS_REACT_NATIVE_HANDOFF.md` at the repository root. JavaScript/TypeScript and the bundled score bridge are testable on Windows. Native Swift compilation, signing, Share Extension/App Groups, Keychain migration, audible playback and purchases require the Mac/iPhone checks in that handoff.

From the repository root:
```sh
npm ci
npm ci --prefix mobile
npm run assets
npm run mobile:prepare
npm run mobile:typecheck
cd mobile
bundle install
bundle exec ruby scripts/configure-ios.rb
cd ios
bundle exec pod install
open GuitarIO.xcworkspace
```

Set `APPLE_TEAM_ID` before running the Ruby configuration script, or choose your team for both targets in Xcode. Enable App Group `group.io.guitario.mobile` for the app and Share Extension. Use one Apple subscription group for monthly/yearly products. Build 160 is a source default; choose a higher unused build number if App Store Connect already contains it.

The score engine is bundled offline; the native application owns SQLite, files and credentials. A bounded/chunked message bridge transfers one GP file at a time and verifies SHA-256. No session tokens are passed to the score WebView.
