# Guitar.io 1.5.2 — guitar controls and service preparation

Local candidate prepared 14 October 2026; not published. Public desktop release remains V1.5.1.

- Guitar details includes a confirmed Delete guitar action. It removes the profile/manual associations and syncs a tombstone while preserving songs, progress, scores and shared artwork.
- Learn’s tutorial/help paragraphs are removed during beta. Controls, scale data, legends and errors remain.
- A visible `!` badge marks an available update before download and a downloaded update ready to install.
- Account & plans prepares Free local sync and AUD 5/month or AUD 50/year Pro: cloud sync, beta features and no ads. Current builds keep online billing/ads disabled until configured.
- Added a Supabase migration/function and cloud transport for authenticated, paid, private metadata/GP/audio/artwork sync; manual cloud sync, durable pending uploads, quota and verified offline downloads.
- Added Stripe subscription/portal and verified Stripe/RevenueCat webhook handlers. Future AI stem processing remains unavailable and unpriced.
- Desktop account sessions use encrypted OS storage; iOS Keychain source is added but still needs native compilation/testing.
- The desktop updater can consume pinned-key, signed HTTPS manifests from managed private release storage while keeping its existing installer/rollback. GitHub remains the default feed until migration is configured and tested.
- Added PC setup, hosted-service configuration and native iOS monetisation/ads handoffs. Native purchase/ad SDK integration and live service deployment remain pending.
