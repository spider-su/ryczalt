# Roadmap — delivery state, not published releases

Milestone labels describe capability progress, not published app versions. Check tags/releases before making release claims. `package.json` and `app.json` currently identify 0.1.0; no public binary is implied.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Complete |
| 0.2 — Tax foundation | Supported-year private-rental calculations, periods/deadlines, exact arithmetic and manual tax payments | Complete for documented 2025/2026 rules; not a tax-return filing tool |
| 0.3 — Apartment lifecycle | Effective-month rent, payment day, agreement reminders, administrator/useful links, recurring bills and reminder preferences | Substantially complete |
| 0.4 — Personal assistant MVP | Pulpit, persistent tasks, local notifications/Web fallback, snooze, source-derived completion, quick actions and light stats | Largely implemented; stabilization, guided setup and recurring custom reminders remain |
| 0.5 — Private beta/release readiness | Real-device notification tests, migration verification, accessibility, payment details, distribution/signing and privacy review | Pending. Standalone EAS identity and local Android debug build are verified; device notification, signing and distribution gates remain. See [RELEASES](RELEASES.md) |

**Dependencies:** the shared tax engine, task projection and effective-month rent model are implemented. Stabilize and verify those contracts before adding new product features.

**Parked next phase:** PIT-28 annual summary, manual JSON backup/import/export and Investory integration. These are not implied by 0.4/0.5.

**Separate product decisions:** deposits, tenant history/rotation, bank feeds, cloud sync, OCR, tenant communication, widgets, property valuation and full expense accounting. Competitors may offer them; that alone is not a reason to add them.

`CHANGELOG.md` records delivered code. This roadmap does not claim that a milestone number corresponds to a Git tag, store build or public release.
