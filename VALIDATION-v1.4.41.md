# V1.4.41 validation

Speed checks cover percentage and BPM rounding, 5% input steps, combined section rates, invalid input, supported-rate fallback and native YouTube rate requests. Precise internal timing calculations remain unchanged.

Passed locally: TypeScript, production build and all 135 regression tests. Browser and desktop acceptance passed typed 92.7% → 95%, 80 BPM at a 120 BPM reference → 65%/78 BPM, 5% section controls and rounded combined rates. Controlled native YouTube playback applied the snapped rates, retained raw sync anchors and passed standard-rate fallback/frame isolation. Tests used synthetic songs and disposable profiles, which were removed.

The release workflow runs the regression suite, production build, desktop packaging and native Apple Silicon updater signing/replacement check before publishing both platform assets. No local app installation or personal library changes are part of this release.
