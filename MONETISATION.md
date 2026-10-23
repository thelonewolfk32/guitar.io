# Guitar.io V1.6 product model

| Capability | Free | Premium |
|---|---|---|
| Local/cloud sync, manual GP import, basic Learn | Included | Included |
| Saved entries, including pending shared links | 1,000 during testing (commercial plan: 5) | Unlimited count |
| Cloud storage | 150 MiB | 1 GiB |
| Individual new files | 30 MiB | 30 MiB |
| Automatic sections / synchronised YouTube | Locked | Included |
| Online metadata and GP discovery | Locked | Included |
| Additional beta features | Owner invitation | Included |

Premium is **AUD $5 monthly or $50 yearly**. There are no ads or advertising integrations. Unlimited song count does not mean unlimited storage. Stem splitting remains unlaunched.

Paid access, beta eligibility, enterprise designation and goodwill allowances are independently derived from billing and owner grants. Revoking one grant leaves other valid grants intact. Cached access lasts at most seven days and never beyond the next grant expiry; online quotas are always server-enforced.

A downgrade keeps existing files and progress. Users choose five active entries. Other entries are archived, read-only, not played/synchronised, and remain exportable. Archived saved entries count towards further additions. Existing bytes above a reduced allowance remain stored; new storage is blocked until under quota or granted an increase.

Desktop uses Stripe Checkout/portal. Apple uses RevenueCat and StoreKit, with monthly/yearly products in one subscription group and a Supabase UUID as the RevenueCat customer identity. Native purchases refresh server-verified access and provide restoration. Do not put Stripe Checkout into the iOS app.

The first GP-discovery release shows source-page candidates and accepts user-supplied GP files. Automatic downloading needs a provider permitting that use. No such provider is configured by default.

See PC_SETUP.md, HOSTED_SERVICES.md, OWNER_SETUP.md and IOS_REACT_NATIVE_HANDOFF.md. No Supabase project or live payment accounts have been configured by this work.
