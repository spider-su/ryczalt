# MVP — private-rental tax and payment assistant

This document defines the functional MVP acceptance scope. The 0.1–0.4 user-facing flows are implemented in the current product line; physical-device verification, signing and distribution remain separate 0.5 readiness work. No public release is implied.

## Core acceptance: rent → tax → deadline

The user records actual rent receipts after checking their bank, sees the ryczałt calculated from confirmed taxable receipts, and sees the tax due date and amount remaining after manually confirmed tax payments. Expected rent, reminders or external links never create financial records or imply payment. This workflow is P0; apartment setup and reminders support it.

## User outcomes and acceptance

1. **Confirm rental income:** record actual receipt date and amount, allow partial/corrected receipts, and keep expected rent separate. Do not infer arrears or create income automatically.
2. **Calculate and pay tax:** calculate from confirmed taxable receipts; show applicable settlement period, obligation, due date, manually confirmed payments and outstanding amount. Corrections update calculations and tasks.
3. **See what needs attention:** Pulpit lists actionable, upcoming and snoozed tasks; dismissing an OS notification does not erase a task. Empty state is useful.
4. **Configure the rental context:** apartment, expected rent/payment day, current tenant/contact, optional agreement end date, administrator portal and useful links. Guided setup reuses Settings and keeps optional fields optional; it never creates financial records or enables reminders without user choice.
5. **Support the core with reminders:** local reminders for rent checks, tax, recurring bills and agreement end dates; small one-time/monthly/yearly personal reminders. Month-end and leap-day behavior is deterministic. Keep this a support function, not a generic task manager.
6. **Handle recurring bills:** support fixed and variable obligations. Fixed partial payments leave the period task open until the expected total is confirmed; variable bills prompt the user to verify the current amount. Task navigation preserves the bill period through confirmation.
7. **Use relevant services:** user-supplied administrator and utility links open externally without credentials, scraping or implied completion.
8. **Show a light overview:** confirmed income, amount to check, tax remaining and attention count; six-month trend and apartment split. No ROI or valuation.
9. **Act quickly:** quick actions preserve apartment/month/remaining expected rent and require manual confirmation. Snooze changes reminder time, not legal/payment due date.

## Next acceptance phase

Annual tax/PIT-28 verification readiness and local JSON backup/restore are near-term priorities, not current MVP functionality. The annual summary must show confirmed taxable receipts, tax due, tax paid and difference for supported years, and help users verify figures against Twój e-PIT/PIT-28. Backup/restore must validate data before import and preserve existing records. See [ROADMAP](ROADMAP.md) milestones 0.6–0.7. Electronic PIT-28 submission remains out of scope.

## Important rental-history rule

A current apartment default rent must not rewrite previous months. The implemented effective-month rent schedule preserves older expectations when rent changes; regression tests cover period-specific expected rent.

## Quality and scope constraints

Expo/React Native/TypeScript, local-first AsyncStorage, runtime validation and versioned migrations. Native local notifications where supported; useful in-app fallback on Web and denied permission. Do not promise guaranteed OS delivery. Preserve historic tenant snapshots, confirmed receipts and tax payments across upgrades. PLN money represented as decimal strings and computed exactly.

Not in the current MVP: annual/PIT-28 verification summary and JSON backup/restore (next acceptance phase), Investory integration, banking integration, automatic confirmations, electronic PIT-28 filing, tenant communication, cloud backend/auth/sync, OCR, property valuation, home-screen widgets, deposit management or comprehensive contract management.

See [USER_FLOWS](USER_FLOWS.md) for scenarios, [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md) for validated patterns and [ROADMAP](ROADMAP.md) for implementation order.
