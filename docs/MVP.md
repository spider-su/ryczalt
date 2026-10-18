# MVP — private-rental tax and payment assistant

This document defines the functional scope for the private-rental POC. Release readiness is tracked in the root [ROADMAP](../ROADMAP.md); no public release is implied.

## Core acceptance: rent → bills → tax

The user confirms actual rent receipts, records recurring bill payments after paying outside the app, and sees ryczałt calculated from confirmed taxable receipts. Rent, bills and tax are confirmed manually in that order. Reminders and expected amounts never create financial records or imply payment. This workflow is P0; apartment setup and reminders support it.

## User outcomes and acceptance

1. **Confirm rental income:** record actual receipt date and confirm the full rent in one action; keep expected rent separate. Initial historical rent is added only after the landlord confirms the selected period in the setup flow.
2. **Track recurring bills:** configure a bill name, due day and optional expected amount for an apartment. Show due and confirmed states, allow manual confirmation of the full actual amount, and schedule local reminders.
3. **Calculate and pay tax:** calculate from confirmed taxable receipts; show applicable settlement period, obligation, due date, and confirm the full outstanding tax amount. Corrections update calculations and tasks.
4. **See what needs attention:** Pulpit lists actionable, upcoming and snoozed tasks; dismissing an OS notification does not erase a task. Empty state is useful.
5. **Configure the rental context:** apartment address, editable rent start date (default January 1 of the current year), owner rent and separate media amount/responsibility, due day, current tenant/contact, optional lease end, administration and electricity-provider URLs. New apartments default to tenant-paid media enabled. Rent reminders are grouped by due date; they are derived from apartments rather than configured individually.
6. **Support the core with reminders:** local reminders for rent checks, bills, tax and lease end. No user-created personal reminders. Keep this a support function, not a generic task manager.
7. **Protect local records:** validated JSON export/import is available and the clear/reinstall/restore round-trip is a release gate. Android system backup is best-effort and device/settings dependent.
8. **Use relevant services:** user-supplied administrator and utility links open externally without credentials, scraping or implied completion.
9. **Show a light overview:** confirmed income, amount to check, tax remaining and attention count; six-month trend and apartment split. No ROI or valuation.

10. **Act quickly:** quick actions preserve apartment/month/remaining expected rent and require manual confirmation. Snooze changes reminder time, not legal/payment due date.

## Next acceptance phase

Annual PIT-28 filing submission remains out of scope. The tax screen is informational; future-year calculations use the latest verified rules provisionally with a visible warning and rules-year reference. JSON backup/import is implemented and required for the POC release gate. Electronic filing remains out of scope.

## Important rental-history rule

A current apartment default rent must not rewrite previous months. The implemented effective-month rent schedule preserves older expectations when rent changes; regression tests cover period-specific expected rent.

When confirming the initial historical-rent import, the selected completed rent periods are added as initial rent receipts and their calculated full monthly tax obligations are recorded as paid. This records the landlord's confirmation for both rent and tax. The start date defaults to January 1 of the current year and can be changed in the first-apartment wizard.

## Quality and scope constraints

Expo/React Native/TypeScript, local-first AsyncStorage and runtime validation with a fresh-install schema. Add schema migrations only when user installations need upgrades. Native local notifications where supported; useful in-app fallback on Web and denied permission. Do not promise guaranteed OS delivery. Preserve historic tenant snapshots, confirmed receipts and tax payments across future upgrades. PLN money represented as decimal strings and computed exactly.

Not in the current POC: custom/personal reminders, bank integration, automatic confirmations, electronic PIT-28 filing, tenant communication, cloud backend/auth/sync, OCR, property valuation, home-screen widgets, deposit management or comprehensive contract management.

See [USER_FLOWS](USER_FLOWS.md) for scenarios, [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md) for validated patterns and [ROADMAP](ROADMAP.md) for implementation order.
