# Roadmap — proposed milestones, not published releases

This roadmap describes the **target sequence**, not a statement that versions/tags/builds have shipped. Check Git tags and release records before assigning public version numbers. `package.json` and `app.json` currently identify 0.1.0 in the inspected branch.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Standalone Expo app, apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Foundation reviewed, tested and merged; PR #1 is open at documentation-refactor baseline |
| 0.2 — Tax foundation | Verified Polish private-rental tax rules, periods, deadlines, exact arithmetic, manual tax payments, outstanding balances | Tax examples and correction scenarios tested; no guessed rules |
| 0.3 — Reminder foundations | Expected payment dates, optional agreement end date, administrator links, recurring bills, native local notifications and Web fallback | Tasks survive app restart; schedules reconcile without duplicates |
| 0.4 — Personal assistant MVP | Pulpit, persistent actionable tasks, snooze, smart completion, quick actions, apartment overview, light stats, custom reminders | Canonical user flows pass end-to-end |
| 0.5 — Private beta/release readiness | Real-device notification tests, migration tests, accessibility, payment details/QR validation where supported, distribution/signing and privacy review | [RELEASES](RELEASES.md) gates satisfied |

**Dependency:** tax reminders consume the tax engine; Pulpit consumes authoritative income/tax/bill projections. Do not duplicate these engines to accelerate UI delivery.

**Parked next phase:** PIT-28 annual summary, manual JSON backup/import/export and Investory integration. These are not implied by 0.4/0.5. Additional ideas (bank feeds, cloud sync, OCR, tenant communication, widgets, valuation) require separate product decisions.

The milestones above are proposals. `CHANGELOG.md` records only actual deliveries.