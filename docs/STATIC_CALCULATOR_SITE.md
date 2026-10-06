# Static calculator site: setup and maintenance

This guide covers the public calculator at `https://ryczalt.smart-box.workers.dev/` and its Android test APK promotion link. The site is a separate static page from the Expo app. It has no server-side calculation or build step; `site/calculator.js` calculates in each visitor's browser.

## Files and hosting

- `site/index.html` contains the page content, SEO metadata, canonical URL, Open Graph tags, and JSON-LD structured data (WebPage and FAQPage).
- `site/calculator.js` contains the tax calculation and form behavior.
- `site/styles.css` contains page styles; `site/favicon.png` is the icon.
- `site/robots.txt` and `site/sitemap.xml` guide search crawlers.
- Root `wrangler.jsonc` deploys the contents of `site/` to the Worker named `ryczalt`.
- The Android APK is distributed separately through GitHub Releases. Do not put it in `site/`.

The `site/` directory is public. Keep documentation, Wrangler configuration, credentials, build output, and private files outside it.

## First-time setup

Requirements: Node.js with `npx`, a Cloudflare account with permission to deploy the `ryczalt` Worker, and this repository checkout.

1. Open a terminal at the repository root (the directory containing `wrangler.jsonc`).
2. Authenticate Wrangler if this machine is not already linked:

   ```sh
   npx wrangler login
   npx wrangler whoami
   ```

3. Confirm `wrangler.jsonc` still names the Worker `ryczalt` and points `assets.directory` to `./site`.
4. Preview locally with `npx wrangler dev`. Wrangler prints the local URL.
5. Deploy from the repository root with `npx wrangler deploy`.

Deploy from this checkout so Wrangler uses the checked-in configuration. Do not run a generated Pages/Workers configuration from a copied folder: that can publish the wrong Worker name or expose files that are not part of the site.

## Routine page updates

1. Edit the source files in `site/`.
2. For tax content, verify rates, thresholds, payment timing, and eligibility language against current Ministry of Finance and legal sources. Keep source links and the “information current as of” date in `index.html` accurate.
3. When changing significant page content, structured data, or the canonical URL, update `<lastmod>` in `sitemap.xml` to the date of that change. Do not change it for routine code-only edits.
4. Keep the visible FAQ answers and `FAQPage` JSON-LD answers in `index.html` synchronized. Keep the canonical URL, Open Graph URL, sitemap location, and `robots.txt` sitemap URL synchronized if the public domain changes.
5. Preview with `npx wrangler dev`, inspect the calculator at desktop and mobile widths, then deploy with `npx wrangler deploy`.
6. Verify the live page and its assets after deployment (commands below). If a verified property is configured in Google Search Console, submit or recheck `/sitemap.xml` after material SEO changes.

## Deploy verification

Run from PowerShell after deployment:

```powershell
$base = "https://ryczalt.smart-box.workers.dev"
foreach ($path in @("/", "/styles.css", "/calculator.js", "/favicon.png", "/robots.txt", "/sitemap.xml")) {
  curl.exe -sS -o NUL -w "$path %{http_code}`n" "$base$path"
}
```

Each expected path should return `200`. Also confirm these implementation/configuration files are not public:

```powershell
foreach ($path in @("/README.md", "/wrangler.jsonc", "/.wrangler/")) {
  curl.exe -sS -o NUL -w "$path %{http_code}`n" "$base$path"
}
```

Those paths should return `404`. Check the deployed page source for its title, description, canonical URL, FAQ content, and current APK download URL. Click the calculator and APK links in a browser as a final visual check.

## Android APK release routine

The public download is a manually installed Android test build, not a Google Play release. Local builds use a generated debug signing key and are for sideload/QA only. A build signed with a different key cannot update the existing installation in place; uninstalling removes app data stored locally. Never use or create a production keystore for this workflow.

1. Commit the app changes intended for this release, then build that checkout from the repository root with JDK 17 and an Android SDK installed. The release's GitHub target should identify the source that produced the APK:

   ```sh
   ./.codex/skills/ryczalt-build-apk/scripts/build_apk.sh
   ```

   The script validates the standalone APK, package ID, and signature before replacing `artifacts/app/ryczalt.apk`. It does not install the app or upload it. Keep the APK out of Git.

2. Review the build output, package (`pl.ryczalt.rental`), size, and SHA-256. Treat build/signature checks as artifact checks, not physical-device testing.
3. Create a new GitHub prerelease tag for the version, for example `v0.1.1-android-test`. Copy `docs/templates/ANDROID_TEST_APK_RELEASE_NOTES.md` to `artifacts/ryczalt-apk-release-notes.md`, then fill in the version, size, and SHA-256. Use a release note that identifies it as a test/sideload APK and describes the signing/data caveat. Upload the artifact under the stable asset filename `ryczalt.apk`:

   ```sh
   gh release create v0.1.1-android-test \
     --repo spider-su/ryczalt \
     --title "Ryczałt 0.1.1 — testowy APK na Androida" \
     --notes-file artifacts/ryczalt-apk-release-notes.md \
     --prerelease \
     --target "$(git rev-parse HEAD)" \
     artifacts/app/ryczalt.apk
   ```

   Update the example version and release notes for each build. Use an explicit commit SHA for `--target`; `--target HEAD` is not accepted by this repository's GitHub Release flow.

4. Update the APK direct download URL in both the visible app section and the matching FAQ answers in `site/index.html`. The pattern is `https://github.com/spider-su/ryczalt/releases/download/<tag>/ryczalt.apk`. Keep the structured and visible FAQ answers synchronized. Update the sitemap `<lastmod>` because this is a material page link/content change.
5. Deploy the site as described above. Verify the release page and direct APK URL in a browser or with `curl.exe -I`; verify that the live page points to the new tag. Keep the previous release available unless there is a reason to remove it.

For a calculator smoke check, enter 10,000 PLN monthly for 12 months: with the standard 100,000 PLN threshold, the annual estimate should be 11,000 PLN. With the spouse threshold enabled for an eligible user, the estimate should be 10,200 PLN. These examples check the calculator UI and are not tax advice.

The APK is larger than Cloudflare Workers' per-file static asset limit, so GitHub Releases hosts the binary while the Worker serves only the link and page assets. Check Cloudflare's current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) if asset limits change.

## Maintenance cadence

- **Whenever tax rules or sources change:** verify the official guidance, update the explanation and calculator logic together, update the source date, then preview and deploy.
- **Whenever the app build changes:** build and inspect the APK, publish a new prerelease, update both page download references, deploy, and verify the live link.
- **At least quarterly and at each calendar-year change:** recheck tax wording/source links, SEO metadata and structured data, sitemap, APK link, and deployed asset status codes.
- **After every deployment:** check the live calculator with representative amounts below and above the threshold, test the spouse-threshold option only when eligible, verify the privacy text, and confirm expected public/private paths.

## Ownership and release notes

The current canonical URL uses the free `workers.dev` hostname; no custom domain is configured by this guide. If a domain is attached later, update all canonical and sitemap references and verify HTTPS and redirects before asking search engines to index it.

Cloudflare hosts the static page. GitHub Releases hosts the APK. Deploying the page does not publish a new APK, and publishing an APK does not update the live page's download link.
