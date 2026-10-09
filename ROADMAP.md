# Ryczałt roadmap

## Product principle: memory outsourcing

Ryczałt is not a nicer spreadsheet. Recording one monthly row is easy; remembering everything around it is the problem.

**Store facts. Derive obligations. Surface exceptions. Become quiet when everything is done.**

Configure an apartment and its terms once. From those facts the app should remember what is expected, when it is expected, what is still unconfirmed, what tax follows, which deadlines are approaching, and what needs attention. Prefer derived tasks over asking the landlord to maintain another reminder or checklist.

A useful feature test is: **does this remove something the landlord otherwise has to remember, calculate, search for, or repeatedly type?** New functionality should normally enrich the existing Pulpit, Mieszkanie, Przychód or Podatek workflow rather than create another major module.

## POC release candidate — single source of truth

This file is the release gate/status source for the lightweight private-rental POC. Product scope is frozen: apartment/current tenant and contact, owner income and media, manual rent and tax payment confirmation, rent/tax/lease reminders, local-first storage, and JSON backup/restore. Bills and user-created personal reminders are removed; older documents containing their legacy fields must continue to load. No backend, bank integration, cloud sync, or electronic filing.

**Status: NOT READY.** Do not tag or publish until every box is supported by candidate-specific evidence.

The public [web tax calculator](https://ryczalt.smart-box.workers.dev/) is a separate informational companion hosted as static Cloudflare Worker assets. It is not an app release gate, app Web build, shared tax engine, or backend. Its purpose, current calculation limits, technology and independent maintenance/deployment checks are documented in [WEB_CALCULATOR](docs/WEB_CALCULATOR.md).

- [ ] Main typecheck, lint, unit tests, Expo Doctor, Web export and Android prebuild green.
- [ ] EAS Android production workflow green; downloadable artifact and build ID recorded against the exact main SHA.
- [ ] Clean Android emulator happy path, correction/recalculation, and restart persistence pass.
- [ ] Legacy local document loads; damaged-storage recovery behaves safely.
- [ ] Export → clear app data/uninstall → reinstall → import round-trip verified, including tax and reminder results.
- [ ] Physical Android notification permission, channel, delivery, tap routing, restart/reboot, revoke/regrant and duplicate checks pass.
- [ ] Tax calculation, overpayment carry-forward, exact-year selection, provisional fallback warning and deadline tests pass.
- [x] PR #38 scope cleanup is merged; bills/custom reminders are absent from UI and notifications.
- [ ] Product, notification, data, tax and public-calculator documentation agrees on the POC scope, calculation boundaries and limitations.
- [ ] Privacy policy is completed and publicly hosted; Google Play Data safety and Apple App Privacy declarations are reviewed against exact release builds; candidate-specific evidence is recorded in [privacy release evidence](docs/PRIVACY_RELEASE_EVIDENCE.md).
- [ ] Native local-data encryption migration, recovery, export/import and Android backup policy are validated on release builds; browser storage limitation is disclosed.

Only after all gates pass: set one consistent POC RC version in package/app metadata, create the release tag, and record SHA, artifact/build ID, test evidence, and known limitations. Do not create a release tag while any CI or acceptance gate is red or unverified.

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
- quarterly settlement dead-code cleanup unless it creates a correctness or maintenance blocker.

## Product boundary

Ryczałt is a small landlord assistant, not a property-management suite. The recurring value proposition remains:

**confirm rent → see what needs attention → know the current tax position → record payment → done.**

Local-first data remains intentional. Native Android/iOS data is encrypted at rest with a device-held key; Android system backup is disabled because ciphertext without that key cannot be restored. JSON export/import remains the user-controlled portability mechanism and exports plaintext. Browser storage is not app-encrypted. See [privacy release evidence](docs/PRIVACY_RELEASE_EVIDENCE.md).


## POC scope simplification

Removed from the product scope before POC freeze:
- recurring household/property bills and their payment tracking,
- user-created personal/custom reminders.

Ryczałt notifications stay domain-native: expected rent, tax deadlines, and rental-agreement dates. Legacy bill/reminder fields may remain readable in local documents/backups for compatibility, but the app no longer creates, edits, schedules, or presents those features.
