# Third-party notices

Guitar.io bundles these third-party components. Their original licences and notices are preserved alongside the assets.

- **alphaTab 1.8.4** — Copyright Daniel Kuschny and Contributors. Mozilla Public License 2.0. The small local lifecycle changes are described below. Its source is available at https://github.com/CoderLine/alphaTab/tree/v1.8.4 . See `dist/vendor/alphatab/LICENSE` and `LICENSE.header` for the full licence and integrated-component notices.
- **Bravura music font** — SIL Open Font License 1.1. The font and notices are in `dist/vendor/alphatab/font/`.
- **SONiVOX EAS soundfont** — Apache License 2.0; supplied with alphaTab. The original copyright notice and provenance README are in `dist/vendor/alphatab/soundfont/`.
- **React / React DOM** — MIT Licence. Original licence files are in `dist/licenses/`.
- **Lucide icons** — ISC licence and embedded-component notices. Original licence file is in `dist/licenses/`.
- **Electron and Chromium** — Electron's MIT licence and Chromium's third-party notices ship with the Windows runtime (`LICENSE.electron.txt`, `LICENSES.chromium.html`).

Historical demo studies retained in source tests are original examples. New v1 libraries do not seed them. No commercial notation or recordings are bundled.

Imported files belong to their respective creators. Guitar.io is an independent project, not affiliated with Arobas Music or Guitar Pro.
# Local alphaTab lifecycle adjustment (v0.3)

The bundled `alphaTab.js` has two small changes to alphaTab 1.8.4: pause safely
disconnects an audio source that has not started, and asynchronous AudioWorklet
initialization discards a result after that source was paused or destroyed.
The complete modification is in `scripts/patch-alphatab.mjs`, applied by
`scripts/prepare-assets.mjs`. The upstream license and notices remain bundled.


## Optional Songsterr download service

Songsterr link import calls the public API of https://www.songsterr-downloader.com/.
The service is maintained separately; its MIT-licensed source is published at
https://github.com/Metaphysics0/songsterr-downloader (Copyright 2026 Ryan Roberts).
Guitar.io does not bundle that converter or copy its conversion implementation.
Songsterr is an independent third-party service; no affiliation is implied.

## Learn theory references

Scale interval definitions were checked against Open Music Theory, Collections and
Scales: https://openmusictheory.github.io/scales2.html . The distinction between
note matching and chord-aware improvisation follows the teaching context described
by Berklee: https://www.berklee.edu/berklee-today/summer-2000/Chord-Tone .
The fretboard code, analysis and practice prompts are original implementations.

## Optional artwork services

Artwork lookup uses MusicBrainz/Cover Art Archive, Apple's iTunes Search API and Wikipedia/MediaWiki page images. These are external services, not bundled catalogues. Image provenance is saved with the chosen artwork; rights remain with the respective providers/creators.

- Apple Search API: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/Searching.html
- MusicBrainz search: https://musicbrainz.org/doc/Indexed_Search
- MediaWiki PageImages: https://www.mediawiki.org/wiki/Extension:PageImages

## Songsterr import and YouTube bar timing

The direct public metadata/track/video-points endpoints, GP conversion conventions and timing approach are adapted from **guitar-pro-youtube-sync**, copyright (c) 2026 teaqu, MIT License. Upstream: https://github.com/teaqu/guitar-pro-youtube-sync . Guitar.io implements this within its existing Electron/alphaTab runtime; Python, yt-dlp, FFmpeg and Deno are not required or bundled. Songsterr notation and YouTube content are fetched only on import or an explicit timing lookup, and are not distributed with the app.

MIT License

Copyright (c) 2026 teaqu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## V1.4 native and LAN dependencies

Capacitor 8.5.2 (Drifty Co., MIT) supplies the native iOS bridge/runtime. Bonjour-service 1.4.4 (ON LX Limited; portions Thomas Watson Steen, MIT), multicast-dns, dns-packet, dns-equal, fast-deep-equal and thunky supply desktop Bonjour discovery. Their complete licenses are included under dist/licenses and public/licenses in source. The native Swift Package resolves the exact Capacitor 8.5.2 runtime. No remote song files or user data are bundled.
