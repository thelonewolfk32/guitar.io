# V1.6 hosted services setup

Status: prepared locally; no Supabase project exists yet. Local tests use isolated fixtures and embedded PostgreSQL. No live customer/payment data was created.

## 1. Staging Supabase
Create `guitario-staging` in Sydney in a Free organisation. Later create `guitario-production` in Sydney in a separately billed Pro organisation. Start with the local iPhone milestone in IOS_FIRST_RELEASE.md. Enable email confirmation, exact application/recovery URLs, manual identity linking and SMTP before hosted tests. Native callback: `io.guitario.mobile.auth://callback`; desktop system-browser callback: `http://127.0.0.1:43871/auth/callback`. Preserve the SDK's per-flow `sb_flow_id` query. Provider setup is in IOS_REACT_NATIVE_HANDOFF.md.

Link the CLI to the project you intend to use, then apply migrations:
```sh
npx supabase login
npx supabase link --project-ref YOUR_STAGING_PROJECT_REF
npx supabase db push
npx supabase secrets set --env-file supabase/.env.local
npx supabase functions deploy guitario
```
Verify the linked reference before db push. Never reset a hosted database.

Migrations install account-wide song reservations, free-cloud/storage rules, independent billing/owner grants, MFA-protected owner workflows, feedback, private practice records, anonymous aggregate counters and education foundations. All app tables are private by default; authenticated clients do not write entitlements directly.

Supabase injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into its function runtime. Do not include reserved SUPABASE_ names in the secrets file. Set ALLOWED_ORIGINS to the exact desktop/browser/admin origins, including your Pages address. Native requests still require verified access tokens. Public client builds use VITE_ACCOUNTS_ENABLED=true, VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY. Billing activation is independent: keep MONETISATION_ENABLED=false until purchase validation passes.

Cloud data is private, scoped to the verified Supabase user. Free storage is 150 MiB, Premium 1 GiB, new files 30 MiB. Downgrades preserve stored bytes. Storage insertion checks its actual/probed byte size against its locked reservation. Run `npm run services:hosted-test` with the isolated staging settings in `.env.acceptance.example`. Upload leases, seven-day orphan cleanup and durable account deletion are implemented by the new lifecycle migration; enable their managed schedule before production. See CLOUD_OPERATIONS.md for monitoring, 30 daily R2 recovery points and the required database-plus-files restore drill.

## 2. Desktop billing
Create AUD 5/month and AUD 50/year recurring Stripe prices. Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRO_MONTHLY_PRICE_ID, STRIPE_PRO_YEARLY_PRICE_ID and BILLING_RETURN_URL.

Webhook endpoint: `https://PROJECT.supabase.co/functions/v1/guitario?route=stripe-webhook`.
Enable checkout.session.completed, customer.subscription.created/updated/deleted and invoice.paid/payment_failed. The server verifies signatures and re-reads provider state. Checkout claims/idempotency prevent simultaneous duplicate sessions and conflicting billing periods.

Use Stripe test mode and ALLOW_TEST_BILLING=true in staging only. Confirm monthly/yearly price, restoration via account sign-in, cancellations, expiry, independent owner gifts and duplicate prevention before enabling live billing.

## 3. Apple billing and music metadata
Create one Apple subscription group with monthly and yearly Premium products, connected to RevenueCat entitlement `pro`. Set REVENUECAT_SERVER_API_KEY and REVENUECAT_WEBHOOK_AUTH on the server. Point the RevenueCat webhook to route=revenuecat-webhook. Use the Supabase UUID as app_user_id.

VITE_REVENUECAT_APPLE_PUBLIC_KEY is a public Apple SDK key. Never bundle a RevenueCat server key. Apple purchases/restoration and native sign-in must be verified on a device.

BRAVE_SEARCH_API_KEY enables permitted GP candidate-page search. APPLE_MUSIC_DEVELOPER_TOKEN enables Apple Music metadata. Spotify/YouTube metadata uses official oEmbed endpoints; source attribution is retained. Shared links never grant access to streaming audio downloads or an unlicensed GP catalogue.

## 4. Owner dashboard, privacy and operations
Follow OWNER_SETUP.md to bootstrap one owner UUID, require MFA, build the dashboard and deploy it to Cloudflare Pages. Do not make a user an owner through editable account metadata.

Before external beta, run two-account/two-device hosted tests, confirm private bucket policies, provider revocation and account deletion, and record actual backup/monitoring/cleanup results. Do not expire saved library slots or shared links as a cleanup shortcut. The owner still needs to create the hosted projects and supply settings privately; no deployment is implied by the local package.

Feature analytics are opt-in aggregate counts. Practice/progress data is private account data. See PRIVACY.md. Teacher/enterprise interfaces are foundations; there are no active teacher/student dashboards in this release.

## 5. Private update hosting
The existing signed HTTPS update-feed implementation remains available. Use `npm run updates:keys` and the update preparation script in a private workspace. Store UPDATE_SIGNING_PRIVATE_KEY only server-side and ship only the public verification key/origin allowlist. Use a Supabase plan whose file-size setting accommodates both platform ZIPs. Test signature/digest validation and rollback before switching the production feed.

Provider references: [Apple multiplatform services](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods), [Spotify February 2026 access changes](https://developer.spotify.com/documentation/web-api/references/changes/february-2026), [Supabase upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits).

Environment reference: [Supabase injected variables and secrets](https://supabase.com/docs/guides/functions/secrets). The disposable Docker stack is for API/database checks; packaged account clients use an HTTPS Supabase project for full application acceptance.
