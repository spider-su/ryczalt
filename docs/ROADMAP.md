# Roadmap — proposed milestones, not published releases

This roadmap describes the **target sequence**, not a statement that versions/tags/builds have shipped. Check Git tags and release records before assigning public version numbers. `package.json` and `app.json` currently identify 0.1.0 in the inspected branch.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Standalone Expo app, apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Implemented and merged |
| 0.2 — Tax foundation | Verified Polish private-rental tax rules, periods, deadlines, exact arithmetic, manual tax payments, outstanding balances | Implemented with tested tax examples and corrections |
| 0.3 — Apartment lifecycle | Effective-dated/period-correct expected rent, payment day, optional agreement end date, administrator links, fixed/variable recurring bills and reminder preferences | Implemented; historical expectations and apartment overview are covered by tests |
| 0.4 — Personal assistant MVP | Pulpit, persistent actionable tasks, native local notifications + Web fallback, snooze, smart completion, guided setup, quick actions, one-time/monthly/yearly personal reminders and light stats | **Functional scope complete**; validation is covered by domain/migration tests and CI. Native delivery/release readiness remains 0.5 work. |
| 0.5 — Private beta/release readiness | Real-device notification tests, migration tests, accessibility, payment details/QR validation where supported, distribution/signing and privacy review | [RELEASES](RELEASES.md) gates satisfied |

**Dependencies:** tax reminders consume the tax engine; Pulpit consumes authoritative income/tax/bill projections. Expected-vs-received history depends on a period-safe expected-rent model. Do not duplicate engines to accelerate UI delivery.

**Parked next phase:** PIT-28 annual summary, manual JSON backup/import/export and Investory integration. These are not implied by 0.4/0.5.

**Separate product decisions:** deposits, tenant history/rotation, bank feeds, cloud sync, OCR, tenant communication, widgets, property valuation and full expense accounting. Competitors may offer them; that alone is not a reason to add them.

The milestones above are proposals. `CHANGELOG.md` records only actual deliveries.
