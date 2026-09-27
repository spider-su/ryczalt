# Changelog

This file records **delivered and verified changes**, not roadmap promises.

## Unreleased

### Fixed

- Added explicit local-data recovery with raw-data copy and confirmed reset; tightened persisted date/period validation.
- Applied confirmed tax payments oldest-outstanding-period first and carried excess credit into later periods without changing income records.
- Ensured Android reminder channels on startup and foreground; kept transient scheduling failures retryable without changing permission state.

### Documentation

- Removed branch-specific status wording from the README and documented the calculation boundary and tax regression-test expectations.

### Added

- Added one-time, monthly and yearly personal reminders with bounded occurrence projection, occurrence-specific task state and local notification scheduling.
- Migrated existing reminders to one-time recurrence in schema version 4 while preserving their dates and legacy task identities.
- Added lightweight Pulpit setup guidance derived from real apartment configuration. It reuses the existing Settings editor, keeps tenant/agreement/portal data optional, and never creates financial records or enables reminders without the user's choice.

### Fixed

- Applied deterministic month-end and leap-day rules to recurring reminders without changing their saved anchor date.
- Removed duplicate Pulpit declarations while preserving guided setup, dashboard sections and notification-permission messaging.
- Kept recurring-bill task periods through Pulpit and notification navigation and recorded that period separately from the actual payment date.
- Derived fixed recurring-bill completion from the exact sum of confirmed payments for that bill and month; variable bills still resolve on one explicit payment without an inferred expected amount.

### Documentation

- Reframed the target product as a local-first personal landlord assistant.
- Defined canonical user flows, technical/data/task architecture, proposed roadmap and release gates.
- Clarified current foundation versus planned tax, Pulpit and local-notification features.
- Added competitive-pattern guidance so proven landlord workflows can be adapted without copying competitor UI or expanding into full property management.
- Added a Codex implementation guide covering product invariants, source-of-truth rules, task/notification architecture, scope guardrails and expected validation.

PRs #5, #6, #7, #8 and #10 delivered assistant stabilization, the native-readiness baseline, guided setup, promotion to `main`, and main/bill correctness repairs. PR #9 cleaned up duplicate guided-setup declarations on `develop`. No public app release is implied. Do not interpret proposed roadmap milestones as published versions.
