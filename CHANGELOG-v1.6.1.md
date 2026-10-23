# Guitar.io 1.6.1

Temporarily raises the free testing allowance to 1,000 saved songs/shared links. Existing libraries within that allowance become active automatically, including clients holding an older five-song entitlement snapshot. Premium tools, file limits and cloud storage allowances keep their existing rules. The commercial five-song model remains the intended post-testing policy.

Fixes the active-song sync deadlock: archived or over-capacity records are deferred without rejecting active records in the same metadata page. Deferred changes and their field clocks persist and replay after selection/access changes, without resetting device identities or metadata checkpoints. Deletions remain effective. Active-song GP/artwork downloads continue independently of deferred records.

Adds metadata-only `account-entries` LAN discovery for choosing songs before GP downloads and refreshes authenticated account selections before LAN reconciliation. Shared React Native changes provide equivalent SQLite deferral/replay and the testing policy; merge these into the newer iPhone working copy and rebuild it.

Hosted projects require the new `202610230001_testing_song_limit.sql` migration and updated Edge Function before their server-side allowance becomes 1,000. No hosted project is deployed by publishing these desktop downloads. See ACTIVE_SYNC_HANDOFF.md and VALIDATION-v1.6.1.md.
