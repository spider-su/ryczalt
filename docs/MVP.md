# MVP — personal landlord assistant

This document defines the functional MVP acceptance scope. The 0.1–0.4 user-facing flows are implemented in the current assistant line; physical-device verification, signing and distribution remain separate 0.5 readiness work. No public release is implied.

## Core user outcomes and acceptance

1. **Configure apartments:** Settings supports apartment, expected rent/payment day, tenant, agreement end date/reminders, administrator portal and useful links. Pulpit derives temporary setup guidance from saved apartment data, shows one next action, and reuses the existing Settings editor. Required completion is based on apartment name, expected rent and payment day; tenant, agreement date and portal stay optional. An optional rent-reminder suggestion never turns itself on.
2. **See what needs attention:** Pulpit lists actionable, upcoming and snoozed tasks; OS notification dismissal does not erase tasks. Empty state is useful.
3. **Check rent:** configure an expected rent schedule/day per apartment, open a contextual reminder, manually record actual receipt date and amount, support partial receipts and show remaining amount *to confirm*. No inferred arrears or auto-created income.
4. **Review tax:** compute verified private-rental ryczałt using actual taxable receipts; support applicable settlement periods and deadlines, manual tax payments and outstanding balance. Corrected receipts/payments update the obligation and tasks.
5. **Remember dates:** local reminders for rent checks, tax, recurring bills and optional rental agreement end date (default 30/7-day options). End date replaces tenancy start as primary visible agreement field; indefinite agreements supported. Preserve legacy start date.
6. **Handle recurring apartment bills:** support fixed and variable recurring obligations. Fixed amounts may be prefilled and partial payments leave the period task open until the expected total is confirmed; variable obligations remind the user to verify the current amount. Opening a task preserves its bill period through manual confirmation.
7. **Use relevant services:** user-supplied per-apartment administrator portal and optional categorized utility links; open externally without credentials, scraping or implicit completion.
8. **Use small personal reminders:** create one-time, monthly or yearly reminders with a title, optional apartment and note. Monthly dates clamp to the target month's last day; a yearly February 29 reminder occurs on February 28 in non-leap years and returns to February 29 in leap years. Completion, dismissal and snooze apply to one occurrence. Do not become a generic task manager.
9. **Understand the month:** compact confirmed income, amount left to check, tax remaining and attention count; six-month income history and per-apartment totals. No ROI or valuation.
10. **Act quickly:** Pulpit quick actions prefill apartment/month/remaining expected rent but require manual confirmation. Snooze alters reminder time, not legal/payment due date.

## Important rental-history rule

A current apartment default rent must not rewrite previous months. Before historical expected-vs-received statistics are treated as authoritative, introduce an effective-date or period-specific expected-rent model so a later rent change preserves older expectations.

## Quality and scope constraints

Expo/React Native/TypeScript, local-first AsyncStorage, runtime validation and versioned migrations. Native local notifications where supported; useful in-app fallback on Web and denied permission. Do not promise guaranteed OS delivery. Preserve historic tenant snapshots, confirmed receipts and tax payments across upgrades. PLN money represented as decimal strings and computed exactly.

Not in this MVP: PIT-28, JSON backup/import/export, Investory integration, banking integration, automatic confirmations, tenant communication, cloud backend/auth/sync, OCR, property valuation, home-screen widgets, deposit management or comprehensive contract management.

See [USER_FLOWS](USER_FLOWS.md) for scenarios, [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md) for validated patterns and [ROADMAP](ROADMAP.md) for implementation order.
