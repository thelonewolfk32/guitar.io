# V1.4.43 validation

Version-only update. The source diff is restricted to package/lock versions, displayed and diagnostic version strings, release labels and required release documents. Updater scripts, playback behavior, dependencies, storage and workflow are unchanged from V1.4.42.

Passed locally: TypeScript, exact source comparison after normalising the version string, package/lock comparison with only version fields excluded, and updater numeric ordering from 1.4.42 to 1.4.43.

The existing release workflow runs regression tests, TypeScript, production builds, Windows packaging and native Apple Silicon updater/signing checks on macOS 15 and 26 before publishing. Interactive automatic updating on the user's PC and MacBook is the purpose of this release; no local installations or personal profiles are changed during publication.
