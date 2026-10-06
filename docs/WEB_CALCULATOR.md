# Public web calculator

## Idea and role

The public calculator is a small, free entry point for a landlord who wants a quick estimate of private-rental lump-sum tax without installing the app. It explains the basic rate bands and links the estimate to official Ministry of Finance guidance. It complements the local-first mobile app; it is not the app's Web edition, a user account, tax filing, or a source of persistent rental records.

**Live page:** [ryczalt.smart-box.workers.dev](https://ryczalt.smart-box.workers.dev/). The page, `calculator.js`, `sitemap.xml`, and `robots.txt` returned HTTP 200 on 2026-10-06. This is an availability/asset check only; it does not prove which repository revision is deployed or recertify the tax calculation.

## Realization and calculation boundary

The page currently presents a 2026 estimate from monthly rent, number of rental months, other annual private-rental income, and an optional spouse threshold. It shows estimated annual revenue, the revenue in each rate band, an approximate tax amount, and the remaining threshold. The page labels the result informational and directs users to verify their circumstances and current rules.

This is deliberately a simplified annual estimate. It does not import app data, calculate monthly/quarterly obligations, reconcile prior payments or overpayments, record receipts, account for every deduction or exceptional tax situation, or file PIT-28. Its rates, thresholds, rounding and explanatory copy are implemented separately from the app's versioned tax engine; changes to either implementation must not be assumed to update the other. Review and update the website's tax-year content and calculation when official rules change.

## Technical implementation

- Static HTML, CSS and browser-native JavaScript; no site build step or application server is required.
- Cloudflare Workers static assets are configured by the repository-root `wrangler.jsonc` (`name: ryczalt`, `workers_dev: true`, assets directory `./site`). The current canonical URL is the free `workers.dev` hostname.
- `site/calculator.js` validates the entered values, recalculates on input, uses integer grosz (`BigInt`) for tax arithmetic, and uses Polish locale currency formatting. The tax base and resulting tax are rounded to whole PLN as implemented in that script.
- The estimate runs in the visitor's browser. The calculator code has no fetch/XHR, persistence, account, or analytics integration; entered amounts are not sent to the Worker by the calculator. Cloudflare still serves the static page and may produce its normal infrastructure/request logs.
- `site/index.html` contains the page and tax explanation, official-source links, canonical/Open Graph metadata and WebPage/FAQ structured data. `site/robots.txt`, `site/sitemap.xml`, stylesheet and favicon are static assets too.
- Deploy from the repository root with `npx wrangler deploy` using the configured Worker. Do not deploy an uncontrolled output directory. After meaningful page/metadata changes, verify the live page and expected public assets, canonical URL, sitemap and robots file; ensure repository/config files are not publicly served.

The web calculator is an independently deployed companion, not part of the Android EAS artifact or the POC app's release proof. Its live content, app-download link, HTTP availability, tax correctness and deployment revision should be checked separately before advertising or relying on them.
