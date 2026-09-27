# Roadmap — proposed milestones, not published releases

This roadmap describes the **target sequence**, not a statement that versions/tags/builds have shipped. Check Git tags and release records before assigning public version numbers. As of 2026-09-27, `package.json` and `app.json` identify 0.1.0; no Git tags are present.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Standalone Expo app, apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Implemented and merged |
| 0.2 — Tax foundation | Verified Polish private-rental tax rules, periods, deadlines, exact arithmetic, manual tax payments, outstanding balances | Implemented with tested tax examples and corrections |
| 0.3 — Apartment lifecycle | Effective-dated/period-correct expected rent, payment day, optional agreement end date, administrator links, fixed/variable recurring bills and reminder preferences | Implemented; historical expectations and apartment overview are covered by tests |
| 0.4 — Personal assistant MVP | Pulpit, persistent actionable tasks, native local notifications + Web fallback, snooze, smart completion, guided setup, quick actions, one-time/monthly/yearly personal reminders and light stats | **Functional scope complete**; validation is covered by domain/migration tests and CI. Native delivery/release readiness remains 0.5 work. |
| 0.5 — Private beta/release readiness | Physical-device notification tests, upgrade/migration check, accessibility and privacy review, supported payment-detail verification, signing and distribution preparation | In progress; outstanding evidence and limitations are tracked in [RELEASES](RELEASES.md) and [PRIVATE_BETA_ANDROID_CHECKLIST](PRIVATE_BETA_ANDROID_CHECKLIST.md) |

**Dependencies:** tax reminders consume the tax engine; Pulpit consumes authoritative income/tax/bill projections. Expected-vs-received history depends on a period-safe expected-rent model. Do not duplicate engines to accelerate UI delivery.

**Parked next phase:** PIT-28 annual summary, manual JSON backup/import/export and Investory integration. These are not implied by 0.4/0.5.

## Deferred beyond the current beta-readiness pass

These are not part of the current 0.4 functional scope. Items that are required for a particular beta distribution remain 0.5 gates as described above; the list below covers broader or later work:

- JSON backup/export and restore; cloud or Investory backup.
- Encrypted storage and a formal security program (`SECURITY.md`); current local-storage/privacy limitations are recorded in [RELEASES](RELEASES.md).
- Tax-year support after 2026, with annual source review, rules update, regression examples, and release checklist.
- Dependency automation (Dependabot/Renovate), full lint coverage, and broader unit/integration coverage beyond current CI.
- Typed navigation cleanup, including `navigationRef as any`; replace `Math.random()` IDs if still relevant.
- Contributor documentation and app/release version metadata cleanup.
- URL allow-listing or scheme hardening while property links remain user-configurable.
- Full production release setup, signing, store distribution and support process.

**Separate product decisions:** deposits, tenant history/rotation, bank feeds, cloud sync, OCR, tenant communication, widgets, property valuation and full expense accounting. Competitors may offer them; that alone is not a reason to add them.

The milestones above are proposals. `CHANGELOG.md` records delivered changes; `RELEASES.md` records current verification and published-release policy.
