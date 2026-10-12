# Guitar.io monetisation recommendation

Prepared 13 October 2026. The product and pricing below are recommendations to validate with users, not established revenue forecasts. No ads, billing SDKs, accounts or paywalls have been added to the application.

Start with a useful free app and a one-time **Pro** unlock that works across iPhone, Windows and Mac. Guitar.io currently stores data locally and syncs over LAN, so a permanent purchase fits its existing costs and offline use. Offer a subscription later when cloud storage, backup or a continuing service creates ongoing value and operating costs.

| Offer | Suggested scope | Price experiment (AUD) |
| --- | --- | --- |
| Free | Import/play personal tabs, basic practice, local file sync and backups; a discreet library sponsor placement | Free |
| Pro | Remove ads, advanced practice/editing/splicing and deeper practice statistics | $39.99–$59.99 once |
| Optional cloud service later | Cross-network sync and managed backup with clear storage limits | $4.99/month or $49.99/year |

Preserve access to users' imported files and basic playback. Do not turn the current sync reliability fix into a paywall. Validate which advanced features people actually value before implementing product limits. Avoid promising unlimited cloud storage: MP3 attachments can dominate transfer and storage costs.

## How ads could fit

Use a small, clearly labelled banner or sponsor card on the library screen. Keep score views, playback, recording and practice loops free of ad interruptions. Paid users should be able to remove all placements. A contextual sponsorship from a guitar shop, string maker or lesson provider is a practical early experiment because it suits a focused audience and can share one placement across platforms.

For mobile network ads, AdMob's documented app setup supports Android and iOS. Its iOS integration requires a native SDK integration alongside the Capacitor app. Google's supported-platform list does not supply an Electron Windows/macOS integration; my recommendation is direct sponsor placements on those desktop apps. [Google AdMob setup](https://support.google.com/admob/answer/9989980?hl=en), [iOS SDK setup](https://developers.google.com/admob/ios/quick-start).

Prefer contextual placements without cross-app tracking. If the chosen iOS SDK tracks users across other companies' apps or websites, implement Apple's required tracking authorisation and honour refusal. Advertising consent and privacy disclosures also depend on the ad provider and markets served. [Apple privacy and data use](https://developer.apple.com/app-store/user-privacy-and-data-use/).

Ads need volume. For illustration only, 100,000 *served* impressions per month at an **assumed AUD $3 effective CPM** produce $300 gross monthly. This is arithmetic, not a quoted market rate or prediction; fill, geography, format and audience change the result. A small specialist audience may support Pro purchases or sponsorship more effectively than banner revenue.

## One purchase across platforms

Use one account and an entitlement service to recognise purchases from Apple and the desktop checkout. Verify store transactions on the backend; support restore purchases, refunds/revocations and cached offline entitlement checks. This is separate from the private LAN song-sync protocol and will require new account/backend work.

For iPhone and a Mac App Store edition, plan to offer digital Pro features through Apple's in-app purchase system. Apple's multiplatform-services rule permits access to purchases from other platforms when those features are also available as in-app purchases. The direct-download Windows/Mac editions can use a website checkout linked to the same account. External purchase-link rules vary by storefront and programme; confirm them when implementing billing. [Apple review guidelines, 3.1.1 and 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#business).

Apply to Apple's Small Business Program if eligible: it currently offers a 15% commission on paid apps and in-app purchases, subject to its USD $1 million proceeds threshold and related-account rules. Enrolment is required. [Apple Small Business Program](https://developer.apple.com/app-store/small-business-program/).

Launch order: prove reliable sync and audible mobile playback; test a Pro price with early users; add a discreet sponsor placement; then build the shared purchase entitlement system. Add network advertising or a cloud subscription once usage and costs justify them.
