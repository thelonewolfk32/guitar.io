# Guitar.io 1.4.3

Incremental LAN sync now recovers missing base metadata for individual changed records. Previously an edited song could move past the shared checkpoint while its original fields stayed behind it. A new device received only the edit, failed with “Incomplete song metadata”, and stopped that batch. V1.4.3 fetches that record's metadata with its original field clocks, applies it atomically, and resumes from the existing checkpoint. Known records still exchange only changed fields. GP/audio files remain lazy.

- Added Sync diagnostics: active stage, named song events, connection/download errors and a local JSON report. Logs retain 120 entries and exclude pairing secrets and tab/audio bytes.
- Recently played timestamps and positions transfer with song metadata. Album names transfer independently of artwork downloads.
- Artwork can retry after metadata arrives. Confident album lookups are retained when the image is unavailable.
- LAN hosts prefer routed addresses over inactive link-local adapters, retain the working endpoint and preserve metadata errors.
- Added a GitHub launch checker and App updates menu offering the Windows or Apple Silicon Mac download. Installation remains manual for current portable/unsigned test packages.
- Added a first-time publishing guide and workflow for tests, desktop builds and version-tag releases.

Update both paired devices to V1.4.3 or later for metadata repair. Existing libraries and pairing settings remain. No iOS build is included.
