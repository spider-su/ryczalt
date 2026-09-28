# Changelog

## Unreleased

- Simplified apartment entry with progressive disclosure, lifecycle states, compact property rows, a calculated tenant-paid total and global delayed rent reminders.
- Added schema-v6 migration defaults and an idempotent completed-month rent bootstrap with separate tenant-total and taxable-owner amounts.

This file records **delivered and verified changes**, not roadmap promises.

## Unreleased

### Fixed

- Persisted-data validation rejects invalid dates and periods; recovery lets the user copy raw data and reset only after explicit confirmation.
- Tax payments apply to the oldest outstanding periods first and carry excess credit forward without changing income records.
- Android reminder channels are ensured at startup and foreground; transient scheduling failures remain retryable without changing permission state.
- Fixed recurring-bill completion uses the exact sum of confirmed payments for that bill and period; partial payments leave the task open. Variable bills resolve after an explicit payment.
- Recurring-bill tasks and notification taps preserve the bill period through confirmation, independently of the actual payment date.
- Reminder recurrence uses deterministic month-end and leap-day rules without changing the saved anchor date.
- Removed duplicate Pulpit declarations while preserving guided setup, dashboard sections and notification-permission messaging.

### Added

- One-time, monthly and yearly personal reminders with bounded occurrence projection, occurrence-specific task state and local notification scheduling.
- Schema version 4 migration that gives existing reminders one-time recurrence while preserving their dates and legacy task identities.
- Lightweight Pulpit setup guidance derived from apartment configuration. It reuses the Settings editor, keeps tenant/agreement/portal data optional, and does not create financial records or enable reminders without user action.

### Documentation

- Updated MVP, notification and user-flow documentation for recurring-bill partial payments and period-aware confirmation.
- Documented the local-first product boundaries, architecture, data/migration contract, calculation expectations, competitive patterns and release gates.
- Repositioned product and roadmap documentation around confirmed rent, tax calculation, payment deadlines, annual verification readiness and local backup/restore priorities; clarified that PIT-28 filing and backup/restore are not implemented.

All entries remain **unreleased** until a versioned release is explicitly tagged. Proposed roadmap milestones are not app versions or published releases.
