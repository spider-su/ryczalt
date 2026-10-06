# Roadmap — delivery history and proposed milestones

This document preserves the historical milestone sequence; the root [ROADMAP](../ROADMAP.md) is the single source of truth for current POC scope, release gates and readiness. Historical milestones are not app versions or evidence of a published release. Current package/app version and tags must be checked live before release.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Standalone Expo app, apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Delivered |
| 0.2 — Tax foundation | Verified Polish private-rental tax rules, periods, deadlines, exact arithmetic, manual tax payments, outstanding balances | Delivered with tested tax examples and corrections |
| 0.3 — Apartment lifecycle | Effective-dated/period-correct expected rent, payment day, optional agreement end date, administrator links and reminder preferences | Delivered; recurring bills were later removed from POC scope |
| 0.4 — Personal assistant MVP | Pulpit, persistent actionable tasks, local notifications, snooze, guided setup and quick actions | Core rent/tax/lease reminders retained; user-created personal reminders were later removed from POC scope |
| 0.5 — Private beta/release readiness | Physical-device notification tests, fresh-install/relaunch check, accessibility and privacy review, supported payment-detail verification, signing and distribution preparation | In progress; evidence and gaps are tracked in [RELEASES](RELEASES.md) and [PRIVATE_BETA_ANDROID_CHECKLIST](PRIVATE_BETA_ANDROID_CHECKLIST.md). Add upgrade tests once a prior version has been distributed. |
| 0.6 — Tax-product completeness | Year-to-date rental tax summary; clear progress against the applicable PLN 100,000 threshold (or confirmed joint-property threshold); annual taxable-income summary; annual tax due/paid/difference; supported-year update checklist; user-facing wording reviewed against current Polish rules | Annual figures reconcile to confirmed receipts and payments in deterministic tests; supported-year rules/review process documented; wording reviewed; no electronic filing |
| 0.7 — Data safety + annual settlement | Annual/PIT-28 verification summary; local-data privacy documentation; migration/recovery tests; consider a user-controlled export/import feature after privacy and format requirements are defined | Summary reconciles to the tax engine; user can verify figures against Twój e-PIT/PIT-28; privacy limitations documented; any export/import contract has explicit validation and recovery behavior |
| 1.0 — Small-landlord public release | A dependable, focused tax/payment assistant for landlords with a few flats | **A landlord can manage a full rental tax year without Excel and without losing records.** Release checks, support expectations, privacy and distribution readiness are complete. |

**Dependencies:** tax reminders and Pulpit consume authoritative income/tax projections; annual review reuses the same versioned tax engine. Do not duplicate calculation engines to accelerate UI delivery.

**Feature freeze:** do not expand generic reminders, personal task management or broad landlord-management workflows. Add them only on explicit request and demonstrated user demand, and only when they do not displace the tax/payment roadmap.

## Later or optional

These items are lower priority than the active POC release gate in the root [ROADMAP](../ROADMAP.md) and require separate product evidence/decisions:

- Investory integration; cloud sync or backup.
- Spouse/shared access, bank feeds, OCR, tenant communication, deposits, documents/e-signatures, maintenance workflows, property valuation/ROI and full expense accounting.
- Encrypted storage and a formal security program (`SECURITY.md`); current local-storage/privacy limitations are recorded in [RELEASES](RELEASES.md).
- User-controlled JSON export/import, restore and cloud backup/sync (the app's rolling local recovery snapshot is not a user-facing backup/export).
- Full PIT-28 annual calculation or electronic submission; per-record tax-year attribution; a multi-year historical rules engine; and automatic retrieval of next-year tax rules.
- Advanced annual reconciliation and broader import/restore URL-scheme handling.
- Full tenancy history, tenant-change workflows, per-month historical rent editing and importing partial/mixed historical payments; bootstrap intentionally assumes a regular completed-month amount and skips months already recorded.
- Audited manual correction workflow for closed historical periods: allow a deliberate correction to a past receipt/payment, preserve the original value and reason, recalculate only affected account tax periods, and show the impact before saving. Until this is designed and tested, closed-period records remain read-only.
- Clarify undocumented historical media responsibility for legacy receipts through explicit user review; schema migration preserves recorded tax amounts and never guesses a split.
- Dependency automation (Dependabot/Renovate), full lint coverage and broader unit/integration coverage beyond current CI.
- Add `scripts/` to lint coverage only after applying the correct Node globals and fixing existing unused-variable findings; current app lint coverage remains `App.tsx` and `src/`.
- CI workflow consolidation.
- Typed navigation cleanup, including `navigationRef as any`; replace `Math.random()` IDs if still relevant.
- Contributor documentation and app/release version metadata cleanup.
- URL allow-listing or scheme hardening while property links remain user-configurable.

**Annual tax-year gate:** before the next tax year is enabled, verify rates, thresholds, spouse/joint-property conditions, deadlines and non-working-day handling against current official guidance; update supported years, examples, tests and release checklist. Do not assume current-year rules carry forward.

The future milestones are plans, not implementation claims. `CHANGELOG.md` records delivered changes; `RELEASES.md` records current verification and published-release policy.
