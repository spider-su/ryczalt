# MVP — personal landlord assistant

The functional MVP target is the user-facing assistant experience described here; **this is not a list of features already shipped**. Current implementation is the three-tab rental foundation on PR #1; tax calculation, Pulpit, notifications, bills and links are not part of that baseline.

## Core user outcomes and acceptance

1. **See what needs attention:** Pulpit lists actionable, upcoming and snoozed tasks; OS notification dismissal does not erase tasks. Empty state is useful.
2. **Check rent:** configure expected rent/day per apartment, open a contextual reminder, manually record actual receipt date and amount, support partial receipts and show remaining amount *to confirm*. No inferred arrears or auto-created income.
3. **Review tax:** compute verified private-rental ryczałt using actual taxable receipts; support applicable settlement periods and deadlines, manual tax payments and outstanding balance. Corrected receipts/payments update the obligation and tasks.
4. **Remember dates:** local reminders for rent checks, tax, recurring bills and optional rental agreement end date (default 30/7-day options). End date replaces tenancy start as primary visible agreement field; indefinite agreements supported. Preserve legacy start date.
5. **Use relevant services:** user-supplied per-apartment administrator portal and optional categorized utility links; open externally without credentials, scraping or implicit completion.
6. **Understand the month:** compact confirmed income, amount left to check, tax remaining and attention count; six-month income history and per-apartment totals. No ROI or valuation.
7. **Act quickly:** Pulpit quick actions prefill apartment/month/remaining expected rent but require manual confirmation. Snooze alters reminder time, not legal/payment due date.

## Quality and scope constraints

Expo/React Native/TypeScript, local-first AsyncStorage, runtime validation and versioned migrations. Native local notifications where supported; useful in-app fallback on Web and denied permission. Do not promise guaranteed OS delivery. Preserve historic tenant snapshots, confirmed receipts and tax payments across upgrades. PLN money represented as decimal strings and computed exactly.

Not in this MVP: PIT-28, JSON backup/import/export, Investory integration, banking integration, automatic confirmations, tenant communication, cloud backend/auth/sync, OCR, property valuation, home-screen widgets or comprehensive contract management.

See [USER_FLOWS](USER_FLOWS.md) for scenarios and [ROADMAP](ROADMAP.md) for implementation order.