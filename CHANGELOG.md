# Changelog

## Unreleased

This file records **delivered and verified changes**, not roadmap promises.

### Added

- Simplified apartment entry with progressive disclosure, lifecycle states, compact property rows, a calculated tenant-paid total and global delayed rent reminders.
- Added schema-v6 migration defaults and an idempotent completed-month rent bootstrap with separate tenant-total and taxable-owner amounts.
- POC tax-year fallback to latest verified rules for future years, with provisional-state calculation metadata and a visible tax-screen warning.

### Fixed

- Removed the invented default lease end, made taxable treatment explicit per apartment, and hardened schema-v7 migrations for reminders and legacy notes/contacts.
- Kept calendar-year navigation available beyond the supported tax-rule table while blocking unsupported calculations; marked historical bootstrap receipt dates as estimates and clamped them to rental start.
- Persisted-data validation rejects invalid dates and periods; recovery lets the user copy raw data and reset only after explicit confirmation.
- Tax payments apply to the oldest outstanding periods first and carry excess credit forward without changing income records.
- Android reminder channels are ensured at startup and foreground; transient scheduling failures remain retryable without changing permission state.
- Fixed the removed-bills/reminders merge leftovers, Settings disclosure declarations and tax-recipient style; legacy fields remain loadable but no longer project tasks or notifications.
- Kept historical rent bootstrap tax payments opt-in so the app never assumes a prior tax payment was made.
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
- Aligned the release checklist and product/data/notification/tax documentation on local JSON export/import as a POC gate, local unencrypted AsyncStorage, best-effort Android backup, removed non-core features, and provisional future tax-year rules.
- Documented the separately hosted public tax calculator's product role, simplified calculation boundary, static Cloudflare Workers implementation and independent tax/deployment maintenance checks.

All entries remain **unreleased** until a versioned release is explicitly tagged. Proposed roadmap milestones are not app versions or published releases.
