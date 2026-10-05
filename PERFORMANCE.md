# Guitar.io v1.2 performance report

Tested 3 October 2026 (Australia/Sydney), using installed Edge on this Windows computer. Every dataset used isolated browser storage. The real Guitar.io profile was untouched.

## Results

| Build | Songs | Median home load | Player ready | MIDI event gap, 95th percentile | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| 1.1.1 | 25 | 718 ms | 670 ms | 12.0 ms | Passed |
| 1.1.1 | 50 | 1099 ms | 672 ms | 12.0 ms | Passed |
| 1.1.1 | 100 | 2261 ms | 829 ms | 12.0 ms | Home-screen threshold exceeded |
| 1.2.0 | 25 | 137 ms | 542 ms | 12.0 ms | Passed |
| 1.2.0 | 50 | 172 ms | 523 ms | 12.0 ms | Passed |
| 1.2.0 | 100 | 202 ms | 585 ms | 12.0 ms | Passed |
| 1.2.0 | 200 | 132 ms | 421 ms | 12.0 ms | Passed |
| 1.2.0 | 300 | 143 ms | 522 ms | 12.0 ms | Passed |

At 100 songs the new home screen was approximately 11.2 times faster. The updated build reached the requested 300-song cap without crossing any declared performance threshold. This is a tested cap, not a universal maximum. MIDI playback in the old build also remained steady; its measured bottleneck was library startup.

The 300-song first launch, including database migration, took about 3.5 seconds. Subsequent median startup was 143 ms. Player readiness was 522 ms. MIDI timeline advancement over six seconds differed from elapsed sampling time by about 48 ms; event gaps at the 95th percentile were 12 ms. Automated timing does not establish subjective audio quality or guarantee that every sound device is glitch-free.

## Method

- Datasets: 25, 50, 100, 200 and 300 unique original synthetic Guitar Pro scores, each 115 bars, with 24 sections, progress values, four tags and a distinct 512px textured JPEG cover. No downloaded music or user files were used. At 300 songs: 9.93 MB tab data and 36.15 MB artwork before derived thumbnails.
- Compare the existing packaged v1.1.1 ASAR with the v1.2 production browser build. Three subsequent page loads per dataset; report their median. First launch/migration is measured separately.
- Stop a build when median startup exceeds 1,500 ms, MIDI event-gap p95 exceeds 150 ms, frame-gap p95 exceeds 50 ms, or MIDI timeline error exceeds 600 ms in the six-second sample. The baseline stopped at 100 songs; the new build continued to 300.
- Actual alphaTab MIDI synthesis runs in headless WebAudio. Frame and player-position events are sampled during six seconds of playback. First soundfont loading is included in player-readiness timing.
- V8 heap measurements in the JSON are snapshots without forced garbage collection and should not be treated as comparable retained-memory measurements.

## Fetching and saving

Baseline startup reads all original song records and all artwork. At 300 songs the new startup trace recorded one songIndex read, three settings reads and five thumbnail reads, with zero song-detail or original-source reads. Covers are loaded near the viewport, shared URL requests are coalesced, and blob URLs have a 64-entry / 32 MB idle-cache limit. Sources use a three-item / 64 MB cache. Active media is retained for as long as needed by its player.

Edits commit only the affected song details, its summary and its change records in an atomic transaction. Original GP/tab bytes are stored once and never rewritten by notation, section, progress or history edits. Removing references checks only those asset IDs; normal saves do not run library-wide asset scans. Explicit backup export intentionally reads the complete library.

Change records include UTC timestamps, a stable device ID, local revisions, deletion tombstones and individual section/recording/annotation changes. Note and tuning maps contain only modified keys. No network sync transport is enabled yet.

## Cleanup and limits

All synthetic songs, artwork, browser contexts, test profiles and the extracted baseline were removed after the stress test. The report and repeatable test source are retained. Results do not cover 30 MB maximum-size files, thousands of songs, cloud latency, LAN transfer or iOS.

Raw samples: PERFORMANCE.json. Reproduce with node tests/library-stress.mjs after building.
