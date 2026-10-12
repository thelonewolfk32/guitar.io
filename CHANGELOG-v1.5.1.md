# Guitar.io 1.5.1 — complete file sync

Prepared 13 October 2026. Desktop release: [Guitar.io 1.5.1](https://github.com/thelonewolfk32/guitar.io/releases/tag/v1.5.1).

- Device sync now downloads missing Guitar Pro originals, MP3 attachments and artwork automatically after metadata arrives, and saves them for offline use.
- Existing metadata-only libraries are repaired without resetting pairing, identities or peer checkpoints. Interrupted transfers resume; corrupt temporary bytes are discarded before retrying.
- Foreground clients can upload their imported files to updated desktop hosts. The additional capability is optional and preserves the V1.5 metadata/pairing protocol.
- Sync displays remaining files and errors. Keep the source app open and its device awake until files finish downloading. YouTube videos continue to stream from YouTube.
- Help now has two brief steps: add a guitar and add a song. The header reads **Learn (beta)**.
- Scrollbars are hidden while wheel, touch and keyboard scrolling remain available.

Native version: 1.5.1, build 151. Mac runtime testing, iPhone compilation and audible iPhone MIDI remain pending on a Mac/real device.
