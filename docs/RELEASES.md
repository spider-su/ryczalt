# Release status and evidence

## Current POC RC gate

The single release gate/status source is the root [ROADMAP](../ROADMAP.md). Current version metadata remains `0.1.0`; no RC version or tag is assigned until every required CI, build, emulator, backup and physical-device gate passes. A green source build is not a device/release acceptance claim.

Release candidate evidence must record the exact main SHA, app version, GitHub CI run, EAS Android build ID and downloadable APK/AAB, emulator happy-path result, physical notification result, backup/restore result, tax checks and known limitations. The final decision and exact candidate details belong here and in the POC checklist only after those checks actually pass.

## Product and privacy boundaries

Native Android/iOS apartment, tenant/contact, income, tax-payment and reminder records are encrypted locally with AES-256-GCM; the device-bound key is stored by SecureStore/Keychain/Keystore. Android system backup is disabled. Valid pre-encryption local documents migrate on first load; JSON export/import remains user-controlled plaintext. Browser storage is not app-encrypted. No backend, account, bank connection, cloud sync or electronic PIT-28 submission exists. Privacy and store declaration evidence remains incomplete; see [PRIVACY_RELEASE_EVIDENCE](PRIVACY_RELEASE_EVIDENCE.md).

Private rental only; manual rent, apartment media-charge and tax payment confirmation; local reminders for rent, media charges, tax and lease expiry. User-created custom/personal reminders remain out of scope. Existing schema-1 recurring bill records continue to load and their legacy task/reminder behavior remains supported; the current Opłaty flow uses apartment terms.

Tax calculations are informational. Rules are versioned by year; exact-year rules take precedence, while every future year without an exact entry uses the latest configured rules provisionally with a visible warning and saved applied-rules-year metadata. Users must verify the result before paying.

Reminder plans are normalized by stable logical key before reconciliation. Identical entries collapse; invalid or conflicting duplicate identities fail before pending OS notifications are changed. Document commits, permission changes, restart and foreground resume trigger serialized reconciliation against the latest committed document. Pending notification behavior is covered by automated tests; Android delivery, tap routing, reboot and device-specific behavior remain separate physical-device gates.

The [public web calculator](https://ryczalt.smart-box.workers.dev/) is a separate static Cloudflare Worker companion, not the app's Web release or an app-data service. Its URL returned HTTP 200 on 2026-10-06; that check did not verify the deployed revision or recertify its tax calculation. Check the live page, APK/download link, tax copy and metadata independently before promoting them. See [WEB_CALCULATOR](WEB_CALCULATOR.md).

## Prior verification (not current candidate evidence)

An Android API 35 emulator was previously used for app launch, core local flows, notification-channel creation with permission denied and malformed-data recovery. That run predates this release-candidate work and does not establish the complete happy path, reinstall/restore, current artifact behavior or physical-device notification delivery/taps. Re-run checks against the exact candidate and update this section with dated evidence.

## Release procedure

1. Keep product/docs changes on a reviewable branch and merge to `main` only after normal CI is green.
2. Verify main CI and EAS Android production workflow for the exact commit; retain the artifact and build ID.
3. Run the full emulator landlord path and backup round-trip, then physical-device notification checks in [PRIVATE_BETA_ANDROID_CHECKLIST](PRIVATE_BETA_ANDROID_CHECKLIST.md).
4. Confirm version consistency across `package.json` and `app.json`; bump to a POC RC only once all gates pass.
5. Create the RC tag only after green CI/EAS and accepted manual evidence; record SHA, artifact, tests and limitations. Never imply a hosted/deployed/mobile result from unit tests or config inspection alone.

## Owner-confirmed historical physical Android smoke test (2026-11-01 report)

The owner confirms that an earlier Android build was successfully installed on a physical Android device and its primary end-to-end rental/tax flow was completed. **Historical physical-device install and main-flow smoke: PASS (owner report).** Exact tested build SHA, APK hash, phone, OS and execution date were not supplied. This supersedes statements implying the application has *never* run on hardware, but does **not** pass the current release-candidate physical-device, notification, signing, update, restore or tax-regression gates. Preserve the existing release evidence requirements and repeat on the exact candidate. This application is `spider-su/ryczalt`, not `ryczalt_it`.

## Documentation and legal handoff

Reuse [the existing privacy policy draft](PRIVACY_POLICY.md) and [privacy evidence checklist](PRIVACY_RELEASE_EVIDENCE.md); complete the publisher/contact/effective-date fields and verify actual release SDK/network behavior before hosting the approved policy. The source is already MIT licensed; retain existing copyright and third-party notices. Before store publication, decide whether a separate user-facing EULA/terms is necessary for this offline, informational tool; do not treat the repository MIT license as a consumer privacy notice or tax accuracy warranty. Verify the tax disclaimer, support route, content rating, Play Data safety and current distribution requirements. Do not duplicate these documents.
