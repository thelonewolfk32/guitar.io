# V1.6.1 active-song sync validation — 23 October 2026

Candidate: 210 automated regression tests pass locally. Desktop, owner, backend and mobile typechecks and desktop/admin production builds pass; the production iOS Metro bundle also builds. Packaged Windows tests downloaded all 50 GP files / 49 covers from a library with a stale five-song selection, completed metadata checkpoints and zero cached originals, then opened a score after the host closed and the recipient restarted. Existing independent-host/audio/GP/artwork checks and the above-five import/UI checks pass. Publication and Mac/native-platform results are recorded after the release workflow completes.

Account-catalogue tests also select a remote entry before either a local song record or GP bytes exist, and the native selection screen refreshes after failed transfers. Windows skipped-version installation and rollback checks pass locally.

Regression coverage includes the 1,000-song boundary and old cached five-song snapshots, mixed active/archived metadata pages, durable replay after restart/selection changes, metadata-only selection without GP reads, concurrent final-slot claims, unchanged storage/RLS rules, and native SQLite deferred records. Existing complete-file replication, independent desktop hosting, offline restart and updater/rollback checks remain release gates.

Windows is the local development platform. Mac release tests and unsigned iOS compilation run in GitHub Actions. The physical iPhone build on the owner's Mac contains newer unshared changes; merge the focused shared/native changes rather than replacing that working folder. Real iPhone rebuild/signing and the owner's 50-song offline acceptance remain device checks. Hosted migration/function deployment is separate.
