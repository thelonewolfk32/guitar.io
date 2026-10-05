# Guitar.io V1.5.0 — Mac/iPhone and AI coding handover

Start here when continuing Guitar.io in Codex, Cursor, Claude Code or another coding tool on the Mac. This replaces the earlier V1.3/V1.4.1 handover. The desktop baseline is the published **V1.5.0** release, tag `v1.5.0`, commit `d891480`. Read [AGENTS.md](AGENTS.md) for project rules and [CODEX_CURRENT_HANDOFF.md](CODEX_CURRENT_HANDOFF.md) for the current implementation.

**Status:** Windows and Apple Silicon desktop builds are published. An iOS Capacitor/Xcode project and native LAN adapter exist, but Swift compilation, iPhone installation, WebKit playback and three-device sync have not been verified. This handover does not include an IPA or a newly built app. Generated web assets are excluded from Git: a fresh clone must run `npm run ios:sync` before Xcode can load the app.

## What connects to what

| Connection | What travels | How |
| --- | --- | --- |
| AI coding tool ↔ local source | Code, build logs, tests | Open the same repository folder; grant local file/terminal access |
| AI coding tool ↔ Xcode | Project inspection, builds, tests | Xcode's built-in agent or local MCP bridge |
| Mac/PC source ↔ GitHub | Source commits and branches | GitHub Desktop or authenticated Git/GitHub CLI |
| Desktop app ↔ GitHub Releases | Version metadata and verified app ZIPs | Existing V1.5 desktop updater |
| iPhone app ↔ Windows/Mac apps | Private library changes, recent activity and requested files | Existing encrypted LAN sync |
| iOS build ↔ iPhone | Compiled and signed app | Xcode Run now; TestFlight later |

GitHub contains application source and desktop releases. Your songs, artwork, progress, originals and pairing keys remain in local app storage and travel through LAN sync. Cloning or pulling the repository does not download your personal library. A GitHub account connection in one AI tool does not automatically authenticate another tool or Mac.

## 1. Prepare the Mac

The user's MacBook has Apple Silicon and was last reported to run macOS Sequoia 15. There is no paid Apple Developer membership. Check its exact macOS version and the iPhone's iOS version before choosing Xcode.

Use Node.js **24 LTS** to match the desktop workflow, Git and **Xcode 26.3 or newer** for Apple's native agent/MCP integration. Capacitor is pinned to **8.5.2** and its build minimum is Xcode 26.0. Xcode 26.3 supports Sequoia **15.6**; later Xcode releases have different macOS requirements. Choose a compatible release rather than assuming the newest Xcode runs on this Mac. [Capacitor requirements](https://capacitorjs.com/docs/getting-started/environment-setup), [Apple compatibility table](https://developer.apple.com/xcode/system-requirements/).

Open Xcode once to finish its component installation. In Terminal verify:

```sh
node --version
npm --version
git --version
xcodebuild -version
xcode-select -p
xcrun --find mcpbridge
```

If the developer directory points only to Command Line Tools, select the installed full Xcode in Xcode Settings → Locations → Command Line Tools. An AI tool running on this PC or on a generic Linux cloud host cannot access the Mac's local Xcode bridge. Run the coding tool on the Mac, or use a configured Mac execution host.

## 2. Get the V1.5 source from GitHub

Repository: [thelonewolfk32/guitar.io](https://github.com/thelonewolfk32/guitar.io).

GitHub Desktop is the easiest option: sign in, clone this repository, fetch/pull `main`, then create an `ios-v1.5-baseline` branch. Open that clone in your coding tool. On the existing PC, source lives in `development/guitar-io`; a GitHub clone has `package.json` directly in its root. Do not look for a nested `development/guitar-io` inside the clone.

The Terminal equivalent for a **new clone**, in your chosen projects directory:

```sh
git clone https://github.com/thelonewolfk32/guitar.io.git guitar-io
cd guitar-io
git fetch origin --tags
git switch -c ios-v1.5-baseline origin/main
git merge-base --is-ancestor v1.5.0 HEAD
git status --short
```

The ancestry command must succeed: the working branch includes the published baseline and the newer handover. `git show v1.5.0:package.json` can confirm the original release. Do not check out only the old tag if you want the updated handover. If future `main` contains another release, inspect its changes and intentionally choose the intended base.

For an **existing clone**, inspect `git status` first, commit or preserve local work, then fetch/pull the appropriate branch. Do not reset local changes or clone over it.

Public source can be read without signing in. To push changes or use pull-request tools, authenticate on the Mac. If using GitHub CLI:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh auth status
```

Follow its browser sign-in. Keep credentials in the account/keychain, not in this document, MCP JSON or Git. An authenticated terminal-capable agent can use `git` and `gh` without a separate GitHub MCP server. If your tool has a GitHub connector, sign into it separately and select this repository. [GitHub authentication](https://cli.github.com/manual/gh_auth_login).

## 3. Let your AI tool use Xcode

Use one of these routes. Every route edits the same local source; the GitHub repository and app's LAN protocol stay the same.

### Agent inside Xcode

Open `ios/App/App.xcodeproj`. In Xcode → Settings → Intelligence enable/install Codex or Claude Agent and sign in. Open the coding assistant, start a conversation and select the agent. Built-in agents receive Xcode's build/test tools. Give the agent this handover and the repository root, so it also sees the shared TypeScript code. [Apple setup](https://developer.apple.com/documentation/xcode/setting-up-coding-intelligence), [OpenAI's Xcode integration](https://learn.chatgpt.com/docs/codex/ide).

### Codex or Claude Code outside Xcode

In Xcode → Settings → Intelligence → Model Context Protocol, enable **Allow external agents to use Xcode tools**. Keep the project open in Xcode. After installing/signing into your chosen CLI, use its matching command:

```sh
# Codex
codex mcp add xcode -- xcrun mcpbridge
codex mcp list
```

```sh
# Claude Code
claude mcp add --transport stdio xcode -- xcrun mcpbridge
claude mcp list
```

Start or reload the agent in the repository folder and accept Xcode's connection prompt. Ask it to list the open project and schemes before editing. These are Apple's documented commands; Xcode access and GitHub sign-in are separate connections. [Apple external-agent bridge](https://developer.apple.com/documentation/xcode/giving-external-agents-access-to-xcode).

### Cursor or another local MCP-capable tool

In Cursor, add this to the existing project `.cursor/mcp.json`, preserving any other servers. For another MCP client, enter the same executable and arguments in its own settings; its JSON format may differ.

```json
{
  "mcpServers": {
    "xcode": {
      "command": "xcrun",
      "args": ["mcpbridge"]
    }
  }
}
```

Keep Xcode open with the project and enable its external-agent setting. Reload the client and verify that Xcode tools are listed. Cursor supports project MCP configuration in `.cursor/mcp.json`. [Cursor configuration](https://prod.cursor.com/help/customization/mcp).

A plain chat window needs an attached Mac coding environment or a human to run these steps. The handover supplies context; it does not grant computer access, GitHub credentials or Apple signing rights automatically.

## 4. Refresh the iOS app from the current source

From the clone's root:

```sh
npm ci
npm test
npm run ios:sync
npm run ios:open
```

`ios:sync` runs the current production web build/typecheck and Capacitor sync. It copies `dist` into `ios/App/App/public` and refreshes Capacitor configuration and its managed Swift package. It does **not** compile or sign an iPhone binary. Run it again after shared UI/TypeScript changes; an Xcode-only rebuild will otherwise show the previous web assets. Do not run `cap add ios` again or use an old V1.3/V1.4 project ZIP.

The iOS project now has `MARKETING_VERSION = 1.5.0` and `CURRENT_PROJECT_VERSION = 150` in both configurations. Its target is iOS **16.0+**; Capacitor's app ID is `io.guitario.mobile`. `package.json` remains 1.5.0. Increment the native build number for later distinct test uploads; a new public desktop release needs its own new version.

Unsigned simulator build, after `ios:sync`:

```sh
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ios/App/build/ios-simulator \
  CODE_SIGNING_ALLOWED=NO build
```

The build path is excluded from Git. If the installed SDK rejects the iOS 16 target, report the SDK and resolve the deployment minimum consistently across the App target and managed package; do not silently claim old-device support. For visual checks, choose an installed iPhone simulator in Xcode and Run.

## 5. Install on your iPhone without paid membership

In Xcode → Settings → Apple Accounts sign in with your Apple Account. In the **App** target → Signing & Capabilities choose your **Personal Team**, with automatic signing. Use a unique bundle identifier only if Apple requires it, then retain that identifier for subsequent test installs.

Connect/trust the iPhone by USB, enable Developer Mode when prompted, select the phone as the run destination and press Run. Allow Local Network access when Guitar.io asks. The Mac's desktop `.app` and Windows `.exe` are separate from this iOS target.

Free Personal Team provisioning expires after **seven days**, so rebuild/reinstall to continue testing. TestFlight/App Store distribution later requires Apple Developer membership and App Store Connect. Native iOS updates use Xcode or TestFlight; the desktop ZIP updater must not run inside the phone app. [Apple personal testing](https://developer.apple.com/help/account/basics/about-your-developer-account), [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [distribution options](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases).

## 6. Bring in the library through LAN sync

Keep V1.5 running on the Windows PC and Mac desktop. Use **Device sync → Local sync ON** on the desktop and iPhone. On the iPhone choose **Add device**, enter the desktop's six-digit code, compare the verification digits and confirm on both screens. Pair the phone with each desktop it should access directly. Turn Auto sync ON for automatic foreground checks, or use Sync now manually.

An Ethernet PC and Wi-Fi Mac/iPhone can share a LAN. Devices must be awake, the desktop app open, and local network/firewall access allowed. Guest/client-isolated networks can block discovery. A phone has no listening desktop endpoint or six-digit host code: it discovers and initiates bidirectional exchanges with desktops.

The first sync copies catalogue/edit metadata. Originals/attachments are represented by descriptors; GP/audio transfer on opening, artwork when requested by visible cards, and Story previews can request their tab content. Cached bytes work offline. There is no central cloud library yet. A missing uncached file needs an awake paired desktop that holds the bytes.

See [SYNC.md](SYNC.md) for the protocol, limits and diagnostics. Preserve the V1.5 base-metadata repair: unknown songs must receive complete metadata before partial edits. Recent activity fields `lastOpenedAt`, `lastPlayedAt` and `lastPlayedBar`, album names and artwork references already participate in song sync. Missing artwork must not block a song or its album name.

## Architecture the next coding tool must preserve

| Files | Responsibility |
| --- | --- |
| `src/main.tsx`, `src/native-platform.ts` | Install the native adapter before React; expose native LAN and Songsterr operations |
| `ios/App/App/GuitarLocalPlugin.swift` | Bonjour discovery, LAN-only URLSession transport and allowed Songsterr HTTPS JSON |
| `ios/App/App/GuitarViewController.swift`, `SceneDelegate.swift`, `Base.lproj/Main.storyboard` | Register and use the custom Capacitor controller/plugin |
| `src/storage.ts`, `src/song-summary.ts` | IndexedDB, lightweight library summaries, individual writes and lazy original/asset reads |
| `src/sync-model.ts`, `src/sync-storage.ts`, `src/lan-sync.ts` | Field clocks, delta pages, base repair, atomic apply/checkpoints and lazy downloads |
| `shared/lan-crypto.mjs`, `shared/lan-pairing.mjs`, `electron/lan-service.mjs` | Compatible encryption/pairing and desktop host transport |
| `src/RecentStories.tsx`, `src/story-cache.ts`, `src/story-player.ts` | Ten recent songs, per-song preview caching, MIDI pitch/tempo and progress |
| `src/MediaPanel.tsx`, `src/Splicer.tsx`, `src/SpliceComparison.tsx` | Recording player/sync settings and splice comparison |
| `electron/update-service.cjs`, `electron/update-installer.cjs`, `.github/workflows/release.yml` | Desktop update/release path; no iOS release job |

- Keep IndexedDB **`guitar-io-v1`**, schema **4**, Electron origin **`guitario://app/`**, iOS origin **`capacitor://localhost`** and current desktop app-data locations. A browser development preview has separate storage. Each device keeps its own identity, keys and checkpoints; never copy an entire desktop profile to the phone.
- Query revision-indexed deltas using separate pull/push checkpoints per peer. Logical UTC field clocks use device ID and origin sequence as deterministic tie breakers. One global “latest timestamp” would miss unrelated edits from another device. Retain tombstones and idempotent delivery.
- Apply a metadata page and its pull checkpoint atomically. Validate first; do not advance past a failed page or reset a checkpoint to hide a missing song. Keep complete-base recovery for newly seen entities.
- Keep home-screen summary reads, content-on-demand and change-only writes. Do not parse all originals on launch, fetch the full library repeatedly or rewrite the catalogue when exiting a song. Auto checks normally exchange a small encrypted head message, so no-change sync can still count a few bytes.
- Preserve AES-GCM envelopes and committed P-256/HKDF pairing. Six digits are discovery, not the encryption password. Legacy long pairing codes contain secrets; keep codes/keys out of logs, commits and handovers. Keep private IPv4/redirect validation and automatic system time for expiring requests.
- iOS is currently a desktop client, not an always-on server. Native LAN requests disable cellular/expensive/constrained access; Songsterr downloads are a separate HTTPS route. Foreground/resume sync must be tested on the phone; iOS suspension does not allow continuous background polling. Direct phone-to-phone hosting and IPv6-only LANs are not implemented.
- Preserve native Local Network/Bonjour declarations and the narrow App Transport Security local-network exception. Do not replace these with unrestricted arbitrary networking to work around a bug.
- Keep V1.5 desktop updater rollback, visible Windows restart and save/sync draining. The native adapter intentionally exposes no desktop update installer; verify that iOS hides those controls.
- Preserve MIDI per-song tuning/tempo in Stories, 5% playback increments, existing recording sync points, Splicer/Undo and learning/progress styling. Native feature parity needs verification rather than an assumption that browser tests prove it.

## Required verification on the Mac and iPhone

Use disposable test libraries/profiles first. Before changing a real library, export a Guitar.io backup with media if needed and keep it outside the public repository.

| Check | Evidence to record |
| --- | --- |
| Build | `npm test`, `ios:sync`, simulator/device compile; exact macOS, Xcode, iOS and source commit |
| Native bridge | `GuitarLocal` registration; allowed/denied/re-enabled Local Network; Wi-Fi reconnect and Bonjour discovery |
| Three devices | Pair with V1.5 Windows and Mac; metadata/song counts, album/artwork, recent order and progress |
| Offline edits | Different-field changes merge; same-field conflicts settle deterministically; repeated delivery is harmless; deletion does not resurrect |
| Transfer economy | No-change sync has small control traffic; unviewed originals stay descriptors; interrupted downloads resume; cached files reopen offline |
| Playback | Touch unlocks audio; Stories use each song's own tuning/BPM, including E-standard Tornado of Souls; correct ten-second timing; count-in/metronome |
| Recording | YouTube availability/referrer behavior, offsets and sync points; supported speed choices and section transitions |
| Editing | Section splitting/progress, note/string edits, Splicer alignment/Undo, guitars, tags and annotations survive sync |
| Native files | Import GP/audio and export/restore a backup on iPhone; use a native document/share adapter if browser download links fail |
| Layout | Portrait/landscape, safe areas, keyboard, touch selection, Stories, settings, learning and Splicer in light/dark mode |
| Lifecycle | Resume after suspension catches up; cellular-only makes no LAN requests; Auto sync OFF stops automatic outgoing checks |

Desktop V1.5 validation is in [VALIDATION-v1.5.0.md](VALIDATION-v1.5.0.md). It does not prove native iOS behavior. Save native results separately with failures and remaining work, excluding private songs, keys and raw personal diagnostics.

## Publish source without replacing the desktop baseline

Push iOS work on its branch and open a pull request targeting `main`. Pull the accepted source on the other computer before continuing there. For a handover-only update, keep `package.json` at 1.5.0, keep `v1.5.0` and its release assets immutable, and avoid creating a version tag. The existing Actions workflow builds desktop candidates on `main` pushes; this handover commit uses `[skip ci]` to avoid a packaging run.

Future functional releases should run the relevant desktop/native checks and use a new increasing version. [GITHUB_RELEASES.md](GITHUB_RELEASES.md) describes desktop packaging; iOS has no automatic signed GitHub release workflow yet.

## Copy this prompt into the next coding tool

> Continue Guitar.io's iPhone work from the published V1.5.0 baseline in https://github.com/thelonewolfk32/guitar.io. Read AGENTS.md, IOS_HANDOFF.md, CODEX_CURRENT_HANDOFF.md, SYNC.md and package.json from my local clone. Verify the branch includes v1.5.0 and preserve local changes. This is the existing React/TypeScript app in Capacitor 8.5.2 with custom Swift LAN transport, not a new SwiftUI rewrite. Work on an iOS branch. Verify access to the repository, authenticated GitHub tools when needed, the open Xcode project and available build destinations; report any connection that still needs my local setup. Refresh assets using npm run ios:sync, compile on this Mac and fix native issues, then help install on my iPhone through my free Personal Team. Preserve V1.5 Windows/Mac compatibility, existing storage origins/device IDs, delta sync/checkpoints/base repair, per-song Story tuning/BPM and private library data. Use isolated data to test Windows/Mac/iPhone pairing, recent activity, album/artwork, offline edits, missing originals, playback and touch layout. Record actual native results and remaining issues. Keep the published V1.5.0 release unchanged; signed/TestFlight distribution is a later step.
