# V1.6.1 active-song sync validation — 23 October 2026

Candidate: 210 automated regression tests pass locally. Desktop, owner, backend and mobile typechecks and desktop/admin production builds pass; the production iOS Metro bundle also builds. Packaged Windows tests downloaded all 50 GP files / 49 covers from a library with a stale five-song selection, completed metadata checkpoints and zero cached originals, then opened a score after the host closed and the recipient restarted. Existing independent-host/audio/GP/artwork checks and the above-five import/UI checks pass. Publication and Mac/native-platform results are recorded after the release workflow completes.

Account-catalogue tests also select a remote entry before either a local song record or GP bytes exist, and the native selection screen refreshes after failed transfers. Windows skipped-version installation and rollback checks pass locally.

Regression coverage includes the 1,000-song boundary and old cached five-song snapshots, mixed active/archived metadata pages, durable replay after restart/selection changes, metadata-only selection without GP reads, concurrent final-slot claims, unchanged storage/RLS rules, and native SQLite deferred records. Existing complete-file replication, independent desktop hosting, offline restart and updater/rollback checks remain release gates.

Windows is the local development platform. Mac release tests and unsigned iOS compilation run in GitHub Actions. The physical iPhone build on the owner's Mac contains newer unshared changes; merge the focused shared/native changes rather than replacing that working folder. Real iPhone rebuild/signing and the owner's 50-song offline acceptance remain device checks. Hosted migration/function deployment is separate.

## Tested source

The merged candidate is `26e97b6ec12f31cbfab9edd3e452e847cc7a4936`, tagged `v1.6.1`. The owner explicitly approved normal PC/Mac auto-update publication with the temporary 1,000-song testing allowance on 23 October.

[Merged-source desktop CI](https://github.com/thelonewolfk32/guitar.io/actions/runs/39919856970) passed Windows and macOS 15/26 packaging, complete-file replication, the 50-GP/49-cover recovery case, independent hosting, offline restart and updater checks. [React Native CI](https://github.com/thelonewolfk32/guitar.io/actions/runs/39919857214) passed both local and full unsigned simulator profiles. Its recorded toolchain was Xcode 26.6 (17F113), Node 24.21.0, Ruby 3.3.13 and Bundler 2.5.22. These simulator results do not establish signing, audible physical-device playback or acceptance of the newer unshared iPhone tree.

The [tagged desktop publication workflow](https://github.com/thelonewolfk32/guitar.io/actions/runs/39923814015) rebuilds and tests the final downloads before its publish job. Publication status and public updater detection are recorded below only after verification.

## Published release

[V1.6.1](https://github.com/thelonewolfk32/guitar.io/releases/tag/v1.6.1) was published as the latest stable release on 23 October 2026 at 08:30:18 UTC. The tagged Windows build and both macOS 15/26 jobs passed, including the final sync and updater gates. The release workflow published complete downloads only after those jobs succeeded.

The public `releases/latest` endpoint returns `v1.6.1` with neither draft nor prerelease set. Running `releaseInfo` from the original `v1.5.1` and `v1.6.0` tags reports `available` / `1.6.1` for Windows x64 and macOS arm64, with matching SHA-256 digests. Public HEAD requests returned HTTP 200 and the expected sizes for all three ZIP downloads. The published checksum file matches GitHub's asset digests:

| Download | Bytes | SHA-256 |
| --- | ---: | --- |
| Windows x64 | 167810749 | `008fd00b2cd385957bbc83ffca18b8c9e6910aebb1d8620e5d4d6045a5852d36` |
| macOS arm64 | 135264578 | `1d041cdf61ed070435e4e6e3da126c627f9fa1bc311e97172e749d9021482a3e` |
| Source | 10637372 | `8b11c26822d84607dede7c6319375b467afbed136d712baf6261e2171a6cc259` |

This verifies publication and original updater discovery; it does not claim an update was installed into the owner's personal PC/Mac profile. The release and its tag remain immutable. Supabase migration/function deployment and the newer iPhone working-copy merge/rebuild were not performed by this desktop release.
