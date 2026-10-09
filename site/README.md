# Public static site

This directory contains two static public pages served by the Cloudflare Worker at [ryczalt.smart-box.workers.dev](https://ryczalt.smart-box.workers.dev/): the private-rental tax calculator at `/` and the JDG accounting product page at `/ryczalt-it/`. They share hosting and branding, but describe separate products and have separate page content, metadata, and SEO URLs. The calculator is not a Web build of either mobile app and does not accept or synchronize app records.

Both pages are plain HTML/CSS static assets and need no build command. The calculator calculation runs in the browser; there is no calculator API, account or persistence. Entered amounts are not sent by the calculator, although Cloudflare may produce its normal infrastructure/request logs. This is a simplified annual estimate—not period settlement, payment reconciliation or PIT-28 filing. The rates, thresholds and rounding logic are separately maintained from the app's versioned tax engine; review both independently against official guidance whenever tax rules change.

The root `wrangler.jsonc` defines the Worker name, `workers.dev` endpoint and asset directory. Deploy from the repository root:

The calculator canonical URL is `https://ryczalt.smart-box.workers.dev/`; the JDG page canonical URL is `https://ryczalt.smart-box.workers.dev/ryczalt-it/`. The JDG page links sign-in to the customer web at `https://ryczalt-it-ui-5411614898.europe-central2.run.app/login`. If a custom domain is attached later, update both pages’ canonical and Open Graph URLs plus sitemap locations together. Keep the app-availability statements accurate; do not imply a store release or a distributable artifact unless verified separately.

The JDG SEO page was ported from the customer web template in the separate `ryczalt_it` repository. Its visible FAQ and FAQPage JSON-LD must stay synchronized. The static copy is under `site/ryczalt-it/`; its independent stylesheet is colocated there. The Worker uses automatic trailing-slash HTML handling so `/ryczalt-it` redirects to the canonical `/ryczalt-it/` URL.

Before deploying, run `npx wrangler whoami` from the repository root to confirm the expected Cloudflare account. Then run `npx wrangler deploy`. After deployment, verify `/`, `/ryczalt-it/`, `/ryczalt-it`, `/ryczalt-it/rental-landing.css`, `/robots.txt`, and `/sitemap.xml`; confirm `/ryczalt-it/` has the canonical URL and `FAQPage` metadata, and that `/wrangler.jsonc` and `/README.md` are not exposed as public assets.
