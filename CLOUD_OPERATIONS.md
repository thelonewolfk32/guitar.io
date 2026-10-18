# Cloud storage, maintenance and recovery

Status: implementation and local fixture tests are prepared. There is no hosted Supabase/R2 project yet. A successful hosted database-and-original-file restore is a production release gate, not a completed check.

## Projects and capacity

Create `guitario-staging` in Sydney in a **Free organisation**, then `guitario-production` in Sydney in a **separately billed Pro organisation**. Upgrading an organisation can change billing for its projects. Staging uses small fixture libraries and temporary owner Premium gifts; keep billing disabled.

Supabase Free currently has 1 GB total file storage. Pro currently starts at US$25/month with 100 GB file storage plus usage charges. Account allowances are limits, not preallocated disk space: five songs / 150 MiB Free, unlimited song count within 1 GiB Premium, 30 MiB per new file. Track pooled capacity as the user count grows. [Supabase pricing](https://supabase.com/pricing).

Song/storage reservations run under account locks. Upload RLS checks actual/probed bytes against the reservation, and cloud-finish checks SHA-256. A downgrade preserves existing entries/files and blocks new consumption above the allowance. Archived entries continue to count and remain referenced. Saved links never expire.

Run `npm run services:hosted-test` only with a **disposable empty Free staging account** configured in `.env.acceptance.local` from `.env.acceptance.example`. The script tests mismatched direct Storage uploads, verified original-byte round trips and simultaneous fifth-entry reservations. It deletes its fixture entries afterward. This supplements local PostgreSQL tests; phone/desktop restarts, tenant isolation and the full storage-quota race still need hosted acceptance.

## Cleanup and owner alerts

Migration `202610180001_storage_lifecycle.sql` adds:
- One-hour renewable upload leases. Clients reserve again to resume after a restart/expiry. An expired lease alone never deletes a saved slot, pending link or metadata baseline.
- Orphan discovery, a **seven-day grace** and a locked reference recheck before deleting Storage objects. `cloud_files` references protect inactive/archived songs as well as active songs. Cleanup marks a path as deleting; new reservations retry rather than racing the Storage deletion. Storage API deletion is used; never delete `storage.objects` rows by SQL.
- A durable account-deletion queue. Provider confirmations precede committed deletion; recent authentication is checked using AMR timestamps rather than refreshed JWT issue time. Google access tokens and Apple authorisation codes are validated against linked provider identities before revocation. Owner accounts require role transfer. Temporary provider tokens are never persisted/logged.
- Monthly operational counts and persistent owner alerts at **50%, 80% and 95%** of configured thresholds. The owner dashboard shows storage, download estimates, accepted app requests, cleanup/deletion queues and alerts, behind role + MFA checks.

Set `MAINTENANCE_SECRET` to an independently generated random credential in Supabase and the scheduler. `route=maintenance` accepts that credential only; ordinary account tokens cannot run cleanup. Configure `OPS_STORAGE_LIMIT_BYTES`, `OPS_DOWNLOAD_LIMIT_BYTES`, `OPS_FUNCTION_LIMIT`, `OPS_COST_LIMIT_USD` and cost-estimate inputs from `supabase/.env.example`. Set production baseline/overage estimates for your chosen plan.

Storage bytes come from Storage metadata. Download traffic is an **estimate from download descriptors**, and invocation counts cover accepted account requests. Retries, webhook/failed requests and other provider traffic can differ. Review Supabase's authoritative Usage/Billing dashboard and configure its spend controls; do not describe the app estimate as an invoice. Operational data is separate from opt-in product analytics.

```sh
node scripts/cloud-maintenance.mjs
```
An operations-only `.env.ops.local` may be used locally. Do not send it in a Source ZIP or install it on a customer's device.

## Private R2 recovery points

Supabase database backups do **not** contain stored object bytes. The additional backup contains database state **and** library/feedback file bytes. [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups).

1. Create a private R2 bucket with public access off. Create a bucket-scoped read/write API token. Keep its secret in the managed scheduler, not Supabase client build settings.
2. Copy `.env.ops.example` to `.env.ops.local` for local drills. Supply the source public URL, service-role key, direct/session-pooler DB URL (port 5432; TLS), R2 account/bucket/access credentials and maintenance secret. Keep a separate recovery record for project Auth/provider settings, SMTP, function secrets and any managed encryption-root-key requirements.
3. Install Docker Desktop for local dumps/restores. The script uses a PostgreSQL image matching the server's major version and exports a repeatable-read database snapshot. A backup lease pauses app-managed object deletion until it finishes. Original objects are immutable hash-addressed bytes.
4. Run `npm run cloud:backup`, then `npm run cloud:verify -- YYYY-MM-DD`. A manifest is published only after all required reads/hashes succeed. R2 writes are fetched and rehashed. Existing objects deduplicate by SHA-256; metadata/database dumps get their own hashes. There is one recovery point per UTC day, with **30 daily points retained**. Unreferenced backup objects are pruned after a successful new point.

The source layout is `guitario/PROJECT_REF/points/YYYY-MM-DD.json`, hash-addressed `objects/`, and private deletion-ledger records. Database dumps include private Auth/account data. Apply least-privilege access to the bucket and scheduler; use TLS and the provider's at-rest encryption. No customer data goes into GitHub Actions artifacts or logs.

The workflow `.github/workflows/cloud-operations.yml` is **disabled** until repository variable `GUITARIO_OPS_ENABLED=true` exists. Create the protected environment `guitario-production-operations` and put the named secrets from `.env.ops.example` there. It runs hourly maintenance and deletion-ledger copying; the first successful run each UTC day creates a backup. Manual dispatch can request a new backup. Enable failure notifications on the workflow. This managed schedule runs independently of the home PC. The same commands can later move to another managed scheduler without changing the app or R2 format.

## Restore drill before production

Use a new isolated **recovery** Supabase project with a compatible PostgreSQL/platform version; no users, app migrations or buckets. This is disaster recovery testing for production data, not a way to copy staging identities into production.

1. Freeze client traffic to the recovery project. Set `RESTORE_SUPABASE_URL`, `RESTORE_DB_URL`, `RESTORE_SERVICE_ROLE_KEY` and `RESTORE_CONFIRM_PROJECT_REF` in the operations environment. The scripts refuse the live source project and require its distinct replacement reference explicitly.
2. Verify the selected point: `node scripts/cloud-backup.mjs verify YYYY-MM-DD`.
3. Restore database state: `node scripts/cloud-backup.mjs restore-database YYYY-MM-DD`. The script refuses occupied destinations. It restores app schema, Auth/app/bucket data and Storage policies; `storage.objects` data is excluded so the Storage API can create correct object metadata with the restored bytes. A failure stops the drill; use a fresh empty recovery target for a retry rather than wiping a project automatically.
4. Restore files: `node scripts/cloud-backup.mjs restore-files YYYY-MM-DD`. It rehashes downloads and uploaded originals. Interrupted file restoration resumes only when existing target bytes already match; differing files are never overwritten automatically.
5. The private R2 deletion ledger is applied after database restoration and excludes deleted-account files. Keep this ledger independent of expiring daily snapshots so a disaster restore cannot revive users already recorded as deleted. The hourly ledger has a corresponding recovery lag; reconcile any later deletion requests before reopening access.
6. Reconfigure project Auth/provider redirect settings, email, function secrets and the function deployment for the **recovery project**. Follow Supabase's current guidance for managed Auth/Storage changes or Vault encryption keys; secret configuration is not reconstructed from the source archive. [Supabase CLI restore considerations](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).
7. Compare fixture user/library/entry/progress/attachment counts, original hashes and database grants against the selected snapshot. Confirm private bucket policies, owner MFA, deleted-account absence and account isolation. Run two-client sync and airplane-mode playback on restored GP/artwork/audio.
8. Record commit, point date, counts, total bytes, hashes, commands and outcomes in the release evidence register. Only after a successful drill may production backup readiness be marked passed. Keep the recovery project private and remove the test copy through its normal lifecycle when finished.

`download-database YYYY-MM-DD` is available for an inspected manual recovery using `RESTORE_OUTPUT_DIR`; it verifies all R2 bytes first. Scripts neither reset a hosted database nor silently restore over live account data.

## Production account deletion and retention

The iPhone asks for DELETE and fresh authentication. Before commit, cancellation removes the pending deletion marker. Once committed, online library access is blocked; cleanup retries storage deletion and Auth/account removal. The app clears its account SQLite/file directory after acceptance. Exported user backups and retained legacy guest migration storage are separate recovery copies under the user's control. Apple/Stripe subscription cancellation is a separate action explained in the UI.

Existing daily backups age out after 30 retained points; source objects become removable only after no retained point references them. Completed-deletion tombstones remain in the private ledger for restore suppression. Publish these operational retention details in the privacy policy and test provider revocation/cleanup on staging before external beta.
