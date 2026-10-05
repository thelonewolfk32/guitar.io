# Guitar.io 1.4.42

Mac updates now validate and normalise signing entitlements using macOS tools before signing, include DER entitlements, and verify the prepared bundle before closing Guitar.io. Successful updates run in the background without opening Terminal. A preparation/signing failure keeps the current app open and reports the failing step instead of incorrectly asking for macOS approval. Local details are retained in `~/Library/Application Support/Guitar.io/update-install.log`.

The standalone Mac preparation command uses the same normalised signing format. Existing V1.4.4/V1.4.41 installations with a failing updater need one manual Mac installation of this release: quit Guitar.io, extract the new ZIP, run **Prepare and open Guitar.io.command**, then close the app and replace your existing Guitar.io.app with the prepared app. The library remains in Application Support. Subsequent updates use the corrected background installer. Windows users can update normally.

Playback still uses the V1.4.41 5% speed increments. No song/library storage migration. Windows x64 and Apple Silicon Mac packages are provided; 1.4.42 is newer than both 1.4.4 and 1.4.41.
