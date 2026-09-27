# Roadmap — delivery status and next steps

Milestones track delivered product capabilities, not published app versions. Check Git tags and release records before assigning public version numbers. `package.json` and `app.json` currently identify 0.1.0; this does not establish a public release.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Standalone Expo app, apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Delivered and merged in PR #1 |
| 0.2 — Tax foundation | Polish private-rental tax calculation, periods, deadlines, exact arithmetic, manual tax payments and outstanding balances | Delivered; covered by tax-domain tests |
| 0.3 — Apartment lifecycle | Effective-month expected rent, payment day, optional agreement end date, administrator and utility links, fixed/variable recurring bills | Delivered in the current app |
| 0.4 — Personal assistant MVP | Pulpit, persistent actionable tasks, local notifications + Web fallback, snooze, smart completion, quick actions and compact statistics | Delivered in the current app; native behavior still needs physical-device verification |
| 0.5 — Private beta/release readiness | Real-device notification tests, migration tests, accessibility, payment details/QR validation where supported, distribution/signing and privacy review | Remaining release gate; see [RELEASES](RELEASES.md) |

**Dependencies:** tax reminders consume the tax engine; Pulpit consumes authoritative income/tax/bill projections. These shared projections are implemented. Do not duplicate engines in follow-up work.

**Parked next phase:** PIT-28 annual summary, manual JSON backup/import/export and Investory integration. These are not implied by 0.4/0.5.

**Separate product decisions:** deposits, tenant history/rotation, bank feeds, cloud sync, OCR, tenant communication, widgets, property valuation and full expense accounting. Competitors may offer them; that alone is not a reason to add them.

`CHANGELOG.md` records merged product and documentation changes. The roadmap does not imply that an app binary or public release exists.
