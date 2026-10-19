# Changelog

## Unreleased

This file records delivered changes for the first public schema-1 release. Pre-release migration experiments and removed features are intentionally not part of the public history.

### Added

- Lightweight private-rental workflow with apartments/current tenant, owner rent and media, manual rent confirmation, bill confirmation and tax-payment confirmation.
- Effective-dated apartment rent terms, lifecycle state, apartment-month snapshots and tax-settlement snapshots.
- Guided first-apartment onboarding and compact Pulpit summaries.
- Local rent, bill, tax and lease-expiry reminders with Android channel/permission handling and duplicate-safe reconciliation.
- Development/demo five-minute notification smoke test.
- Local encrypted native storage with user-controlled JSON export/import and last-good recovery copy.
- Provisional future-year tax-rule fallback that records which verified rule year was applied.
- Separately hosted informational web tax calculator.

### Changed

- Pulpit prioritizes monthly profit (ZYSK), then rent and tax; redundant aggregate expected-rent text is hidden for a single active apartment.
- Rent, bill and tax flows remain manual-confirmation only; expected amounts never become confirmed facts automatically.
- Tax periods are monthly only for the POC.
- User-created personal/custom reminders are removed from the product surface and notification routing.

### Fixed

- Tax overpayments carry forward without changing income records.
- Invalid dates, periods, references and monetary values are rejected before calculations.
- Corrupted local data is surfaced for explicit recovery/reset instead of silently replacing user data.
- Reminder channel creation is independent of permission state and transient scheduling failures remain retryable.
- Demo-mode mutations remain isolated from the real local document.
- Recurring-bill completion follows the saved payment record and period.

### Documentation

- Aligned product, data, notification, tax, emulator-regression and release documentation with the current schema-1 POC.
- Removed obsolete pre-release migration/correctness notes that no longer describe current code.

All entries remain **unreleased** until a versioned release is explicitly tagged.
