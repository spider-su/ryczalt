# MVP — private-rental tax and payment assistant

This document defines the functional scope for the private-rental POC. Release readiness is tracked in the root [ROADMAP](../ROADMAP.md); no public release is implied.

## Core acceptance: rent → tax → deadline

The user records actual rent receipts after checking their bank, sees the ryczałt calculated from confirmed taxable receipts, and sees the tax due date and amount remaining after manually confirmed tax payments. Expected rent, reminders or external links never create financial records or imply payment. This workflow is P0; apartment setup and reminders support it.

## User outcomes and acceptance

1. **Confirm rental income:** record actual receipt date and amount, allow partial/corrected receipts, and keep expected rent separate. Do not infer arrears or create income automatically.
2. **Calculate and pay tax:** calculate from confirmed taxable receipts; show applicable settlement period, obligation, due date, manually confirmed payments and outstanding amount. Corrections update calculations and tasks.
3. **See what needs attention:** Pulpit lists actionable, upcoming and snoozed tasks; dismissing an OS notification does not erase a task. Empty state is useful.
4. **Configure the rental context:** apartment address, owner rent and separate media amount/responsibility, due day, current tenant/contact, optional lease end, administration and electricity-provider URLs. Rent reminders are grouped by due date; they are derived from apartments rather than configured individually.
5. **Support the core with reminders:** local reminders for rent checks, tax and lease end only. No bills or user-created personal reminders. Keep this a support function, not a generic task manager.
6. **Protect local records:** validated JSON export/import is available and the clear/reinstall/restore round-trip is a release gate. Android system backup is best-effort and device/settings dependent.
7. **Use relevant services:** user-supplied administrator and utility links open externally without credentials, scraping or implied completion.
8. **Show a light overview:** confirmed income, amount to check, tax remaining and attention count; six-month trend and apartment split. No ROI or valuation.
9. **Act quickly:** quick actions preserve apartment/month/remaining expected rent and require manual confirmation. Snooze changes reminder time, not legal/payment due date.

## Next acceptance phase

Annual PIT-28 filing submission remains out of scope. The tax screen is informational; future-year calculations use the latest verified rules provisionally with a visible warning and rules-year reference. JSON backup/import is implemented and required for the POC release gate. Electronic filing remains out of scope.

## Important rental-history rule

A current apartment default rent must not rewrite previous months. The implemented effective-month rent schedule preserves older expectations when rent changes; regression tests cover period-specific expected rent.

## Quality and scope constraints

Expo/React Native/TypeScript, local-first AsyncStorage and runtime validation with a fresh-install schema. Add schema migrations only when user installations need upgrades. Native local notifications where supported; useful in-app fallback on Web and denied permission. Do not promise guaranteed OS delivery. Preserve historic tenant snapshots, confirmed receipts and tax payments across future upgrades. PLN money represented as decimal strings and computed exactly.

Not in the current POC: recurring bills, custom/personal reminders, bank integration, automatic confirmations, electronic PIT-28 filing, tenant communication, cloud backend/auth/sync, OCR, property valuation, home-screen widgets, deposit management or comprehensive contract management.

See [USER_FLOWS](USER_FLOWS.md) for scenarios, [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md) for validated patterns and [ROADMAP](ROADMAP.md) for implementation order.
