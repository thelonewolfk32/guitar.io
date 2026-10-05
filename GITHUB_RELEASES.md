# First-time GitHub and update publishing guide

Repository: https://github.com/thelonewolfk32/guitar.io

## What goes where

| Place | Contents | Purpose |
| --- | --- | --- |
| `main` branch | Source, tests, scripts and README | Editable code and history |
| Tag, e.g. `v1.4.3` | A label on one source commit | Identifies the shipped version |
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
2. Choose a new tag, e.g. `v1.4.3`, targeting the corresponding source commit on `main`.
3. Title it `Guitar.io 1.4.3` and copy `CHANGELOG-v1.4.3.md` into the description.
4. Attach the matching Windows ZIP, Mac ZIP and SHA256SUMS file. Attach the Source ZIP too if its checksum is listed.
5. Keep the release as a draft until both desktop packages finish uploading. Mark it as latest, leave **pre-release** unchecked, then publish.

The checker expects these exact names, using the actual version:

```text
Guitar-io-1.4.3-Windows-x64.zip
Guitar-io-1.4.3-macOS-arm64.zip
```

Do not replace published ZIPs with different code under the same version. Ship a new version instead.

## Publish future versions automatically

`.github/workflows/release.yml` runs tests and packages both desktops on pushes to `main`. Download the completed run's **Artifacts** from the Actions tab to test a candidate. Mac archives use the official verified ARM64 runtime; this packaging job does not provide native Mac playback testing.

For version 1.4.4:

1. Pull `main`, make changes, then run in the source folder:

   ```sh
   npm version 1.4.4 --no-git-tag-version
   npm test
   npm run build
   ```

2. Add `CHANGELOG-v1.4.4.md` and `VALIDATION-v1.4.4.md`. Record changes and actual test results; the packages include these documents.
3. Commit the source, version/lock files and documents to `main`, then push.
4. After checking the `main` workflow is green, create and push the tag:

   ```sh
   git tag v1.4.4
   git push origin v1.4.4
   ```

5. The tag workflow checks that the version matches `package.json`, builds both ZIPs, uploads them to a draft release, and publishes the complete release after successful checks.
6. Test it on both computers. Launch checks will offer that version on the next launch, or use **App updates → Check now**.

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
python scripts/package-mac.py --asar "$env:GUITARIO_OUTPUT_DIR/Guitar-io-1.4.3-Windows-x64/resources/app.asar"
```

Substitute the current version for 1.4.3. These scripts refuse to overwrite release ZIPs.

Electron 44 downloads its native runtime when it first runs. The explicit installer step makes that runtime available before these packaging scripts copy it.

## How the checker works

The app checks GitHub's newest stable published release, compares numeric versions, and selects the exact Windows x64 or Mac ARM64 ZIP. A routine check fetches small release metadata and uses ETags to reuse unchanged responses. It does not upload library data or automatically download packages. No GitHub login token is bundled into the app. Offline errors leave Guitar.io usable.

Use the top-right download icon to change the repository, disable launch checks, or check now. Drafts and pre-releases are ignored. Missing platform packages and private repositories show an explanatory message.

Installation currently means downloading and replacing the app. Fully automatic Mac installation needs properly signed releases; add Apple Developer signing and notarization when membership is available. Use the included preparation command for current Mac test packages. Windows is currently a portable ZIP.

Official references: [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [Releases API](https://docs.github.com/en/rest/releases/releases), [Electron updates/signing](https://www.electronjs.org/docs/latest/api/auto-updater).
