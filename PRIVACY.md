# V1.6 data handling implementation notes

This is a technical inventory for the eventual published privacy policy, not a substitute for that policy.

- Account library: GP originals, selected attachments, artwork, metadata, edits and progress are scoped to the signed-in account in private Supabase storage/tables. Local and account libraries use separate workspaces.
- Sharing: the iOS extension stores selected music URLs/share text in the App Group inbox until the app can accept them within its song allowance. Premium metadata/search sends the selected link or title/artist to the relevant music provider or Brave Search. No streaming audio is extracted.
- Practice: versioned session/progress events are private account data. They record actual playback intervals and user-reported progress, not measured playing accuracy.
- Teaching: organisation/assignment/permission interfaces exist only as foundations. Future sharing needs explicit student consent, revocation, assignment scope and an appropriate minors/guardian policy before activation.
- Feedback: only a submitted message, category, contact choice and optional app-version/platform diagnostics are stored. Attachments are explicitly selected by the user, at most two screenshots/text files of 1 MiB each.
- Optional usage reporting: disabled by default. The client sends whitelisted aggregate feature counts and a random batch nonce for retry deduplication. Aggregate records contain no song content, links, account IDs or persistent device identifiers. Opt-out clears unsent counts.
- Operational data: authentication, billing, rate limiting, support and administrator audit logs are separate from optional usage analytics. Infrastructure may process network identifiers; do not market the entire service as having no identifiable operational data.
- Credentials: desktop sessions use OS encryption; native sessions use Keychain. No cloud session enters the score WebView. Server keys are excluded from client builds and source archives.
- Migration: the old WebKit library and Keychain entries are retained after verified native migration for recovery.

Before public account signup/charging, publish the policy, configure retention and account deletion, review provider terms, and complete hosted and native-device validation. No production service was deployed during local preparation.
