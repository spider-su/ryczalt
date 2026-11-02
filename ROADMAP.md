# Ryczałt roadmap

## Product principle: memory outsourcing

Ryczałt is not a nicer spreadsheet. Recording one monthly row is easy; remembering everything around it is the problem.

**Store facts. Derive obligations. Surface exceptions. Become quiet when everything is done.**

Configure an apartment and its terms once. From those facts the app should remember what is expected, when it is expected, what is still unconfirmed, what tax follows, which deadlines are approaching, and what needs attention. Prefer derived tasks over asking the landlord to maintain another reminder or checklist.

A useful feature test is: **does this remove something the landlord otherwise has to remember, calculate, search for, or repeatedly type?** New functionality should normally enrich the existing Pulpit, Mieszkanie, Przychód or Podatek workflow rather than create another major module.

## POC release candidate — single source of truth

This file is the release gate/status source for the lightweight private-rental POC. Product scope is apartment/current tenant and contact, owner income and apartment media, manual rent/media-charge/tax payment confirmation, rent/tax/lease reminders, local-first storage, and JSON backup/restore. Arbitrary recurring-bill creation and user-created personal reminders are out of scope; saved legacy bill records remain readable and may retain legacy task behavior. No backend, bank integration, cloud sync, or electronic filing.

**Status: NOT READY for public store release.** A private alpha may proceed after the separate alpha gate below, without claiming the full public release gates are met.

### Private Android alpha gate (separate from public store release)

- [ ] CI green for the exact candidate commit (typecheck, lint, unit tests, Android prebuild).
- [ ] Signed installable alpha APK built from the exact candidate SHA; record artifact, certificate identity and SHA-256. A debug-signed APK must not be misrepresented as a Play AAB.
- [ ] Emulator happy path: apartment setup, monthly rent / media / tax confirmation, future-effective terms, cold restart, and JSON export → clean test install → import round-trip.
- [ ] Physical-device checks: rent, utilities, tax and lease-end notification delivery **and tap destination**; note any Android delay/permission limitations.
- [ ] Known limitations and evidence recorded in `docs/RELEASES.md` and the alpha test release notes.
- [ ] Revalidate any changed notification routing on the candidate APK; do not mark this gate passed from unit tests alone.

The alpha gate does not waive public privacy and store data declarations, signed production AAB validation, broader recovery testing or production publication review. Do not tag or publish a candidate before the relevant gate has evidence.


The public [web tax calculator](https://ryczalt.smart-box.workers.dev/) is a separate informational companion hosted as static Cloudflare Worker assets. It is not an app release gate, app Web build, shared tax engine, or backend. Its purpose, current calculation limits, technology and independent maintenance/deployment checks are documented in [WEB_CALCULATOR](docs/WEB_CALCULATOR.md).

- [ ] Main typecheck, lint, unit tests, Expo Doctor, Web export and Android prebuild green.
- [ ] EAS Android production workflow green; downloadable artifact and build ID recorded against the exact main SHA.
- [ ] Clean Android emulator happy path, correction/recalculation, and restart persistence pass.
- [ ] Current schema-1 document validation and damaged-storage recovery behave safely.
- [ ] Export → clear app data/uninstall → reinstall → import round-trip verified, including tax and reminder results.
- [ ] Physical Android rent, bill and tax notification permission, channel, delivery, tap routing, restart/reboot, revoke/regrant and duplicate checks pass.
- [ ] Tax calculation, overpayment carry-forward, exact-year selection, provisional fallback warning and deadline tests pass.
- [ ] Product, notification, data, tax and public-calculator documentation agrees on the POC scope, calculation boundaries and limitations.
- [ ] Privacy policy is completed and publicly hosted; Google Play Data safety and Apple App Privacy declarations are reviewed against exact release builds; candidate-specific evidence is recorded in [privacy release evidence](docs/PRIVACY_RELEASE_EVIDENCE.md).
- [ ] Native local-data encryption, recovery, export/import and Android backup policy are validated on release builds; browser storage limitation is disclosed.

Only after all gates pass: set one consistent POC RC version in package/app metadata, create the release tag, and record SHA, artifact/build ID, test evidence, and known limitations. Do not create a release tag while any CI or acceptance gate is red or unverified.

### Implementation snapshot

- New-apartment save seeds assumed full rent receipts, applicable apartment-media confirmations and calculated tax payments only for completed months from the rental start through the previous month. The current and future months remain pending for manual confirmation. A second apartment starting in the current month creates no pre-start history and does not invalidate an already-confirmed apartment.
- Opłaty is derived from effective apartment media terms and confirmed as one full monthly amount. No UI adds arbitrary Opłaty. Saved legacy recurring-bill records remain readable/actionable; personal reminders are not exposed or scheduled.
- The Tax tab shows the selected period's calculation and year-to-date taxable revenue/threshold progress. A consolidated annual due/paid/difference and PIT-28 verification summary is still planned; electronic filing is out of scope.
- Local AES-GCM encryption, recovery snapshots, and user-controlled JSON export/import are implemented. JSON backup/restore round-trip on the release candidate is still a gate; JSON exports are plaintext and Android system backup is disabled.

### Latest recorded emulator evidence

The latest available focused recheck is [2026-10-20](artifacts/emulator-e2e/20261020-1430-7f4bdd4-recheck/results.md). It passed the second-apartment current-month start-date and advanced-field save/restore checks, but reports a failure because an invalid administrator URL did not produce visible feedback. That run used app source commit `6e8f3d3`; subsequent commits include app-source changes, so neither that run nor the full run validates current source or the candidate artifact. Re-run against the candidate and resolve or explicitly retest the validation-feedback case before treating the emulator gate as passed.

## Next after POC validation

Prioritize only when real-user feedback supports the need:

1. **Year-end PIT-28 summary/export** — annual reconciliation and a useful hand-off for filing; keep tax rules sourced and versioned.
2. **Cross-device/shared backup or sync** — evaluate only if file backup is insufficient for users.
3. **iOS distribution** — TestFlight/App Store release work after the local Simulator build proves compatibility.
4. **Pricing/paywall** — validate willingness to pay and the useful free/paid boundary before implementation.
5. **Store release hardening** — privacy/release metadata, production signing, store screenshots and release automation.

## Parked

Do not implement during the POC unless user evidence changes the priority:

- bank account/import integration;
- cloud accounts, backend and automatic synchronization;
- tenant portal / CRM / broad property-management features;
- additional tax regimes beyond the supported private-rental ryczałt scope;
- analytics/engagement machinery;
- speculative dashboard/UI polish after the freeze;
- gentle tenant payment reminders after the due date plus a grace period when payment is still unconfirmed; start with landlord-approved SMS/WhatsApp/email text and cancel pending reminders after confirmation;
- rent/indexation review reminders derived from apartment terms;
- stronger lease-expiry actions/reminders without a contract-management module;
- lightweight deposit/kaucja state and settlement reminder;
- contextual anomaly checks (unexpected amount, possible duplicate, unusual period/date) rather than an analytics dashboard;
- lightweight annual landlord summary, with PIT-28 export considered separately above;
- document attachments only if users demonstrate a real need; avoid document-management scope;

## Product boundary

Ryczałt is a small landlord assistant, not a property-management suite. The recurring value proposition remains:

**confirm rent → confirm bills → confirm tax → done.**

Local-first data remains intentional. Native Android/iOS data is encrypted at rest with a device-held key; Android system backup is disabled because ciphertext without that key cannot be restored. JSON export/import remains the user-controlled portability mechanism and exports plaintext. Browser storage is not app-encrypted. See [privacy release evidence](docs/PRIVACY_RELEASE_EVIDENCE.md).


## POC scope simplification

Removed from the product scope before POC freeze:
- user-created personal/custom reminders.

Apartment media charges remain a focused payment flow derived from effective apartment terms, with full manual confirmation. No arbitrary bill creation or transfer is offered or inferred. Notifications remain domain-native: rent, tax and rental-agreement dates.
