# First-time GitHub and update publishing guide

Repository: https://github.com/thelonewolfk32/guitar.io

## What goes where

| Place | Contents | Purpose |
| --- | --- | --- |
| `main` branch | Source, tests, scripts and README | Editable code and history |
| Tag, e.g. `v1.4.4` | A label on one source commit | Identifies the shipped version |
| GitHub Release | Windows ZIP, Mac ZIP, checksums and notes | App downloads for each computer |
| Local app data | Personal songs, artwork, progress and pairing | Your separate private library |

App ZIPs belong in Releases rather than `main`. The source is public by your choice; personal libraries, audit copies and pairing secrets are excluded from the upload.

## Upload your first file on the website

1. Open the repository and select `main`.
2. Choose **Add file → Upload files** and drag in a source/documentation file. To edit the existing README, open it and click the pencil.
3. Enter a commit message describing the change, e.g. `Explain installation`.
4. Choose **Commit directly to the main branch**, then **Commit changes**.

A commit saves code. It does not publish an app download by itself.

## Keep source on both PC and Mac

In GitHub Desktop, sign in and choose **File → Clone repository → thelonewolfk32/guitar.io** on each computer. Keep the current branch on `main`.

Before working, choose **Fetch origin**, then **Pull origin** if updates are available. Edit source in that clone, inspect the Changes list, write a useful summary, choose **Commit to main**, then **Push origin**. Pull on the other computer to receive the source changes. Avoid editing the same file on both computers before pushing/pulling.

Each computer downloads the app ZIP from Releases, so app updates do not require moving files between devices. LAN sync separately transfers your personal library changes.

## Upload an already-built version

1. Open **Releases → Draft a new release**.
2. Choose a new tag, e.g. `v1.4.4`, targeting the corresponding source commit on `main`.
3. Title it `Guitar.io 1.4.4` and copy `CHANGELOG-v1.4.4.md` into the description.
4. Attach the matching Windows ZIP, Mac ZIP and SHA256SUMS file. Attach the Source ZIP too if its checksum is listed.
5. Keep the release as a draft until both desktop packages finish uploading. Mark it as latest, leave **pre-release** unchecked, then publish.

The checker expects these exact names, using the actual version:

```text
Guitar-io-1.4.4-Windows-x64.zip
Guitar-io-1.4.4-macOS-arm64.zip
```

Do not replace published ZIPs with different code under the same version. Ship a new version instead.

## Publish future versions automatically

`.github/workflows/release.yml` runs tests and packages both desktops and a source ZIP on pushes to `main`. Download the completed run's **Artifacts** from the Actions tab to test a candidate. Mac archives use the official verified ARM64 runtime. A native Apple Silicon job checks local signing, bundle replacement and cleanup before tagged releases can publish; MacBook playback, relaunch and approval prompts still need a user-session test.

For version 1.4.42:

1. Pull `main`, make changes, then run in the source folder:

   ```sh
   npm version 1.4.42 --no-git-tag-version
   npm test
   npm run build
   ```

2. Add `CHANGELOG-v1.4.42.md` and `VALIDATION-v1.4.42.md`. Record changes and actual test results; the packages include these documents.
3. Commit the source, version/lock files and documents to `main`, then push.
4. After checking the `main` workflow is green, create and push the tag:

   ```sh
   git tag v1.4.42
   git push origin v1.4.42
   ```

5. The tag workflow checks that the version matches `package.json`, builds both ZIPs, uploads them to a draft release, and publishes the complete release after successful checks.
6. Test it on both computers. Launch checks will offer that version on the next launch, or use **Help (?) → version number → Check for updates**.

Let the workflow create the release for this route. Do not manually create a release with the same tag while it is building. If a run fails, open its red step's log. Never force-push `main` or move a published version tag.

## Local packaging on Windows

In PowerShell in the source folder:

```powershell
$env:GUITARIO_OUTPUT_DIR = Join-Path (Get-Location) 'release/artifacts'
npm ci
npm test
npm run build
node node_modules/electron/install.js
node scripts/package-local.mjs
./scripts/archive-windows.ps1
node scripts/fetch-mac-runtime.mjs
python scripts/package-mac.py --asar "$env:GUITARIO_OUTPUT_DIR/Guitar-io-1.4.4-Windows-x64/resources/app.asar"
```

Substitute the current version for 1.4.4. These scripts refuse to overwrite release ZIPs.

Electron 44 downloads its native runtime when it first runs. The explicit installer step makes that runtime available before these packaging scripts copy it.

## How the updater works

Open Help (?) and click the version number. The menu contains Check for updates and Auto-updater OFF/ON. The release repository is configured in source, with no repository controls or external links in the menu.

Checks fetch small release metadata with ETags. Downloads require the exact platform ZIP, GitHub's SHA256 asset digest, matching package version/identity and safe archive paths. Keep both desktop assets uploaded before publishing. The workflow's release uploads supply the digest through GitHub's API automatically.

A manual check downloads, verifies, installs and restarts if a newer version exists. Auto-updater downloads on launch and installs when the library is idle. Open players, editors, active saves and sync work defer installation. The same app-data profile remains in use. Windows replaces packaged files and rolls back partial failure; unrelated folder files are preserved. Mac attempts local signing of a staged bundle before swapping and reopening it, with Terminal/approval fallback. Native Mac updating needs a MacBook test.

V1.4.3 only has the earlier download checker. Install V1.4.4 manually once; subsequent versions can be installed from inside the app. Fully signed/notarized Mac distribution remains a later Apple Developer setup.

Official references: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [Releases API](https://docs.github.com/en/rest/releases/releases), [Electron lifecycle](https://www.electronjs.org/docs/latest/api/app).
