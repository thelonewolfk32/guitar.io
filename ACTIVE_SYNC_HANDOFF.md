# V1.6.1: active-song sync and temporary 1,000-song testing

The owner authorised this patch on 23 October 2026. Update both desktop hosts through the normal GitHub updater. Preserve the newer iOS build-161 working copy on the Mac.

## Temporary allowance

`shared/library-policy.mjs` is the shared policy: 1,000 Free songs/shared links during testing, with the intended commercial baseline still five. `src/plans.ts` lifts old cached Free snapshots to the testing baseline while preserving independent goodwill allowances and Premium access. Libraries at or below the testing allowance automatically become active, so a prior five-song selection does not leave the owner's 50 songs archived.

Cloud storage remains 150 MiB Free / 1 GiB Premium and 30 MiB per new file. No advertising or Premium capability changes are introduced. The backend remains authoritative for hosted reservations: deploy the matching migration/function rather than bypassing a server quota in the client.

## Desktop/mobile integration

- `head` retains protocol 3 and advertises `accountEntries`, `deferredApply`, `songPolicy` and `testingSongLimit` as optional compatibility fields. A peer's advertised allowance is informational, never a trusted entitlement grant.
- Authenticated LAN clients refresh the existing account `entries` route before reconciliation and use their cached selection offline. The Edge Function also accepts `account-entries` as an alias and pages database results, including retained deletion markers.
- A paired client can request `{op:'account-entries',after:'',limit:100}` before any GP download. Response: `{entries:[{id,kind,active,details}],after,more}`. This is catalogue metadata only; selecting songs does not require score bytes, parsing, or importing every original.
- Desktop `applySyncPage` serialises metadata admission, applies active rows and deletions, and atomically stores deferred rows alongside the received checkpoint. Deferred field versions are retained in `lan:deferred-sync:<entity-key>` settings and replay on the next sync after selection/capacity changes. Acknowledging a page does not discard its deferred edits.
- Active GP/artwork queues continue while archived transfers wait. Diagnostics distinguish complete library counts, active-content availability and deferred metadata. Original IDs, pairing keys, progress, tombstones and checkpoints remain intact.
- Native `NativeRepository.applyLan` stores equivalent `deferredSync` SQLite records in the same transaction as the LAN checkpoint; `replayLanDeferred` reapplies them later. Native backups retain the deferred store and validate large libraries in bounded batches. Sync clocks observe deferred remote changes so later deletion cannot resurrect an older deferred edit.

## Xcode merge steps

Merge `shared/library-policy.mjs`, `src/plans.ts`, and the focused changes in `mobile/src/repository.ts`, `mobile/src/lan.ts`, `mobile/src/backup.ts` and `mobile/App.tsx`. Preserve the newer embedded `ScoreWeb/rn-main.jsbundle` fix, persistent queue/diagnostics, resumable transfers and reusable native network sessions from the owner's iOS tree. Rebuild the embedded score and React Native bundle actually loaded by that project. Do not overwrite the full mobile folder or change the bundle identifier/signing team.

The currently installed iPhone may still enforce five songs until its shared policy is updated and rebuilt. Reading desktop account entries alone does not override the phone's entitlement policy. Do not trust a LAN host to grant Premium.

## Hosted project

For a configured project, deploy migrations through `202610230001_testing_song_limit.sql` and the updated `supabase/functions/guitario` function. The migration replaces only the base song allowance and reactivates retained entries where the whole library fits; it preserves data, grants, RLS, storage quotas and larger-library selections. It does not reset or recreate a project. Publishing a desktop release does not deploy Supabase.

## Device acceptance

1. Upgrade PC/Mac and rebuild the iPhone with the shared 1,000-song testing policy; retain normal libraries and pairings.
2. With the existing 50 metadata entries and missing originals, confirm no five-song selection is needed, GP/artwork transfers begin, and all required bytes become available offline.
3. Keep an explicit small-limit fixture for the future commercial policy: one archived row must not block selected songs; change the selection and confirm deferred edits replay without checkpoint resets.
4. Restart, disconnect both computers and open several GP files with their artwork on the phone. Record original hashes/counts. Confirm deleted songs do not return.
