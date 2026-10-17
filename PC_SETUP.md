# Guitar.io: home PC setup

V1.6 local development and service setup. Your PC does not need to remain on for customer sync or updates.

## Download on Windows
| Programme | Purpose | Download |
|---|---|---|
| Node.js 24, including npm | Build desktop, admin and mobile JavaScript | https://nodejs.org/en/download |
| Git for Windows | Source updates and GitHub publishing | https://git-scm.com/downloads/win |
| Docker Desktop with WSL 2 | Optional local Supabase stack | https://docs.docker.com/desktop/setup/install/windows-install/ |
| Stripe CLI | Sandbox webhook testing | https://docs.stripe.com/stripe-cli |
| VS Code, optional | Code/configuration editing | https://code.visualstudio.com/download |

Supabase CLI is pinned in the project and installed by `npm ci`; do not install a separate global copy. The fast PostgreSQL tests do not need Docker.

From the folder containing package.json:
```powershell
npm ci
npm test
npm run typecheck
npm run services:typecheck
npm run admin:typecheck
npm run admin:build
npm run build
npm run mobile:install
npm run mobile:typecheck
npm run mobile:prepare
```

For the disposable local Supabase stack, start Docker and run:
```powershell
npm run services:start
npx supabase db reset
npx supabase functions serve guitario --env-file supabase/.env.local
```
Copy the example environment files before entering your own settings. `db reset` is only for a disposable local database. Do not use it against customer data.

## Online accounts to create
- Supabase: Auth, Postgres, private song/attachment storage and optional private update archives.
- Stripe: desktop monthly/yearly AUD prices and customer billing portal.
- RevenueCat: Apple purchases mapped to the same Guitar.io account.
- Apple Developer / App Store Connect: App Groups, signing, subscriptions and TestFlight.
- Cloudflare Pages: owner dashboard hosting.
- Brave Search API: GP candidate-page searches.
- Apple Music developer token: optional Apple Music metadata enrichment.

Start with a separate Supabase staging project, not a customer project. Continue in HOSTED_SERVICES.md and OWNER_SETUP.md. Service secrets go in Supabase's secret settings; only the publishable URL/key and RevenueCat Apple public SDK key go into client build settings.

## Apple development on the Mac
Install Xcode/command-line tools, Node 24, Watchman, Ruby 3.3 and Bundler. The mobile Gemfile pins CocoaPods 1.17.0 and xcodeproj 1.28.1. Follow IOS_REACT_NATIVE_HANDOFF.md; Windows cannot compile/sign the native iOS application.

## Updates without public GitHub
The desktop updater already supports an HTTPS feed with Ed25519-signed manifests and private Supabase Storage downloads. Your source repository and customer download host can be separate. Existing GitHub-updater installations need a bridge release carrying the new public verification key/feed settings. Keep the signing private key server-side.

The desktop ZIPs exceed Supabase Free's 50 MB individual-file limit, so choose a hosting plan supporting those archives before moving the feed. Keep stable updates available to free users; beta eligibility is separate. iOS updates go through TestFlight/App Store.

Official references: [React Native Apple environment](https://reactnative.dev/docs/set-up-your-environment), [Supabase upload limits](https://supabase.com/docs/guides/storage/uploads/file-limits).
