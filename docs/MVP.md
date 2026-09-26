# MVP — personal landlord assistant

The functional MVP target is the user-facing assistant experience described here; **this is not a list of features already shipped**. Current implementation is the three-tab rental foundation on PR #1; tax calculation, Pulpit, notifications, bills and links are not part of that baseline.

## Core user outcomes and acceptance

1. **Complete setup once:** guided setup helps add an apartment, expected rent, payment day, current tenant, agreement end date/reminders and administrator portal. The setup checklist disappears when complete.
2. **See what needs attention:** Pulpit lists actionable, upcoming and snoozed tasks; OS notification dismissal does not erase tasks. Empty state is useful.
3. **Check rent:** configure an expected rent schedule/day per apartment, open a contextual reminder, manually record actual receipt date and amount, support partial receipts and show remaining amount *to confirm*. No inferred arrears or auto-created income.
4. **Review tax:** compute verified private-rental ryczałt using actual taxable receipts; support applicable settlement periods and deadlines, manual tax payments and outstanding balance. Corrected receipts/payments update the obligation and tasks.
5. **Remember dates:** local reminders for rent checks, tax, recurring bills and optional rental agreement end date (default 30/7-day options). End date replaces tenancy start as primary visible agreement field; indefinite agreements supported. Preserve legacy start date.
6. **Handle recurring apartment bills:** support fixed and variable recurring obligations. Fixed amounts may be prefilled; variable obligations remind the user to verify the current amount in the relevant portal or bill.
7. **Use relevant services:** user-supplied per-apartment administrator portal and optional categorized utility links; open externally without credentials, scraping or implicit completion.
8. **Use small personal reminders:** one-time, monthly or yearly reminder with title, optional apartment and note. Do not become a generic task manager.
9. **Understand the month:** compact confirmed income, amount left to check, tax remaining and attention count; six-month income history and per-apartment totals. No ROI or valuation.
10. **Act quickly:** Pulpit quick actions prefill apartment/month/remaining expected rent but require manual confirmation. Snooze alters reminder time, not legal/payment due date.

## Important rental-history rule

A current apartment default rent must not rewrite previous months. Before historical expected-vs-received statistics are treated as authoritative, introduce an effective-date or period-specific expected-rent model so a later rent change preserves older expectations.

## Quality and scope constraints

Expo/React Native/TypeScript, local-first AsyncStorage, runtime validation and versioned migrations. Native local notifications where supported; useful in-app fallback on Web and denied permission. Do not promise guaranteed OS delivery. Preserve historic tenant snapshots, confirmed receipts and tax payments across upgrades. PLN money represented as decimal strings and computed exactly.

Not in this MVP: PIT-28, JSON backup/import/export, Investory integration, banking integration, automatic confirmations, tenant communication, cloud backend/auth/sync, OCR, property valuation, home-screen widgets, deposit management or comprehensive contract management.

See [USER_FLOWS](USER_FLOWS.md) for scenarios, [COMPETITIVE_ANALYSIS](COMPETITIVE_ANALYSIS.md) for validated patterns and [ROADMAP](ROADMAP.md) for implementation order.