# Public static calculator

This directory contains the standalone public calculator served at [ryczalt.smart-box.workers.dev](https://ryczalt.smart-box.workers.dev/). It is a free informational entry point to the Ryczałt product: visitors can estimate annual private-rental lump-sum tax, then learn about the separate mobile app. It is not a Web build of the app, and it does not accept or synchronize app records.

The static page is HTML/CSS/browser JavaScript and needs no build command. Calculation runs in the browser; there is no calculator API, account or persistence. Entered amounts are not sent by the calculator, although Cloudflare may produce its normal infrastructure/request logs. This is a simplified annual estimate—not period settlement, payment reconciliation or PIT-28 filing. The rates, thresholds and rounding logic are separately maintained from the app's versioned tax engine; review both independently against official guidance whenever tax rules change.

From the repository root, run `npx wrangler deploy` to upload these assets to the configured Worker. The root `wrangler.jsonc` defines the Worker name, `workers.dev` endpoint and asset directory. After deploying, verify the page and expected assets, canonical metadata, sitemap and robots file, and confirm that repository/configuration files are not exposed.

The canonical URL and sitemap currently use `https://ryczalt.smart-box.workers.dev/`. If a custom domain is attached later, update the canonical URL, Open Graph URL, sitemap location and sitemap URL together. Keep the app-availability message and download link accurate; do not imply a store release or a distributable app artifact unless verified separately.
