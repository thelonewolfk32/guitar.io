# Guitar.io owner administration

The owner dashboard is a separate web application under admin. It shares Supabase Auth with the product; the backend checks both owner membership and MFA on every administrative request.

## Bootstrap
1. Create and verify your owner account in the staging project.
2. Copy its UUID from Supabase Auth.
3. Run the following once in the project's SQL editor, replacing the UUID:
```sql
insert into public.owner_roles(user_id)
values ('YOUR-VERIFIED-OWNER-UUID')
on conflict do nothing;
```
Owner roles cannot be assigned through a public client or profile field.

Set public build values from .env.example, including VITE_ACCOUNTS_ENABLED=true. Add your dashboard's exact URL to server ALLOWED_ORIGINS.

```sh
npm ci
npm run admin:typecheck
npm run admin:build
```
Create a Cloudflare Pages project, set the build command to `npm run admin:build`, and output directory to `admin-dist`. Supply only public Supabase build configuration. The supplied _headers file blocks framing and restricts network destinations; add an exact custom Supabase domain to connect-src if you use one.

## Usage
Sign in and enrol a TOTP authenticator when prompted. Accounts, grants, feedback and audit data are unavailable until MFA verification succeeds.

Search an email or account UUID, then select the account. You can grant Premium, enterprise designation, beta eligibility, additional song slots and storage, with an optional expiry. Enter a reason. Grants can be revoked independently; Stripe/Apple billing records are retained and never overwritten by gifts.

Suspension blocks online services/storage access. Offline cached access can persist until the entitlement cache expires. Keep a recovery path through the project owner; an owner cannot suspend their own account from this dashboard.

Feedback has new/reviewing/planned/closed statuses. Attachments are explicit user-selected screenshots/text and use short-lived private URLs. Contact information is used only where the user permitted contact. Aggregate feature reports do not contain account IDs or song titles. Audit records include the administrator, target, action, reason and time.

Beta eligibility is an access grant; iOS distribution still uses App Store Connect/TestFlight. Enterprise designation prepares later organisation/seat tools; it does not create a functioning teacher classroom or charge enterprise prices.
