# Roadmap — delivery history and proposed milestones

The product priority is confirmed income → ryczałt calculation → payment deadline → annual settlement readiness. Milestones 0.1–0.5 are the historical delivery sequence and are retained below; they are not app versions or evidence of a published release. Check Git tags and release records before assigning public version numbers. As of 2026-09-27, `package.json` and `app.json` identify 0.1.0; no Git tags are present.

| Milestone | Scope | Exit condition |
|---|---|---|
| 0.1 — Rental foundation | Standalone Expo app, apartment CRUD, manually confirmed partial receipts, tenant snapshots, local validation and serialized writes | Delivered |
| 0.2 — Tax foundation | Verified Polish private-rental tax rules, periods, deadlines, exact arithmetic, manual tax payments, outstanding balances | Delivered with tested tax examples and corrections |
| 0.3 — Apartment lifecycle | Effective-dated/period-correct expected rent, payment day, optional agreement end date, administrator links, fixed/variable recurring bills and reminder preferences | Delivered; apartment lifecycle, tenant/media split, compact setup, period expectations and idempotent completed-month bootstrap are covered by tests |
| 0.4 — Personal assistant MVP | Pulpit, persistent actionable tasks, native local notifications + Web fallback, snooze, smart completion, guided setup, quick actions, one-time/monthly/yearly personal reminders and light stats | Functional scope delivered; no claim of physical-device or release readiness |
| 0.5 — Private beta/release readiness | Physical-device notification tests, upgrade/migration check, accessibility and privacy review, supported payment-detail verification, signing and distribution preparation | In progress; evidence and gaps are tracked in [RELEASES](RELEASES.md) and [PRIVATE_BETA_ANDROID_CHECKLIST](PRIVATE_BETA_ANDROID_CHECKLIST.md) |
| 0.6 — Tax-product completeness | Year-to-date rental tax summary; clear progress against the applicable PLN 100,000 threshold (or confirmed joint-property threshold); annual taxable-income summary; annual tax due/paid/difference; supported-year update checklist; user-facing wording reviewed against current Polish rules | Annual figures reconcile to confirmed receipts and payments in deterministic tests; supported-year rules/review process documented; wording reviewed; no electronic filing |
| 0.7 — Data safety + annual settlement | Annual/PIT-28 verification summary; local-data privacy documentation; migration/recovery tests; consider a user-controlled export/import feature after privacy and format requirements are defined | Summary reconciles to the tax engine; user can verify figures against Twój e-PIT/PIT-28; privacy limitations documented; any export/import contract has explicit validation and recovery behavior |
| 1.0 — Small-landlord public release | A dependable, focused tax/payment assistant for landlords with a few flats | **A landlord can manage a full rental tax year without Excel and without losing records.** Release checks, support expectations, privacy and distribution readiness are complete. |

**Dependencies:** tax reminders consume the tax engine; Pulpit consumes authoritative income/tax/bill projections; the annual summary reuses the same verified tax engine and supported-year rules. Do not duplicate calculation engines to accelerate UI delivery.

**Feature freeze:** do not expand generic reminders, personal task management or broad landlord-management workflows. Add them only on explicit request and demonstrated user demand, and only when they do not displace the tax/payment roadmap.

## Later or optional

These items are lower priority than 0.6–1.0 and require separate product evidence/decisions:

- Investory integration; cloud sync or backup.
- Spouse/shared access, bank feeds, OCR, tenant communication, deposits, documents/e-signatures, maintenance workflows, property valuation/ROI and full expense accounting.
- Encrypted storage and a formal security program (`SECURITY.md`); current local-storage/privacy limitations are recorded in [RELEASES](RELEASES.md).
- User-controlled JSON export/import, restore and cloud backup/sync (the app's rolling local recovery snapshot is not a user-facing backup/export).
- Full PIT-28 annual calculation or electronic submission; per-record tax-year attribution; a multi-year historical rules engine; and automatic retrieval of next-year tax rules.
- Advanced annual reconciliation and broader import/restore URL-scheme handling.
- Full tenancy history, tenant-change workflows, per-month historical rent editing and importing partial/mixed historical payments; bootstrap intentionally assumes a regular completed-month amount and skips months already recorded.
- Clarify undocumented historical media responsibility for legacy receipts through explicit user review; schema migration preserves recorded tax amounts and never guesses a split.
- Dependency automation (Dependabot/Renovate), full lint coverage and broader unit/integration coverage beyond current CI.
- Add `scripts/` to lint coverage only after applying the correct Node globals and fixing existing unused-variable findings; current app lint coverage remains `App.tsx` and `src/`.
- CI workflow consolidation.
- Typed navigation cleanup, including `navigationRef as any`; replace `Math.random()` IDs if still relevant.
- Contributor documentation and app/release version metadata cleanup.
- URL allow-listing or scheme hardening while property links remain user-configurable.

**Annual tax-year gate:** before the next tax year is enabled, verify rates, thresholds, spouse/joint-property conditions, deadlines and non-working-day handling against current official guidance; update supported years, examples, tests and release checklist. Do not assume current-year rules carry forward.

The future milestones are plans, not implementation claims. `CHANGELOG.md` records delivered changes; `RELEASES.md` records current verification and published-release policy.
