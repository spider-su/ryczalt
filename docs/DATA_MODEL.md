# Data model and migration contract

## Current persisted schema

`RentalDocument.schemaVersion = 2`; storage key `pl.ryczalt.rental.localDocument.v1`. Arrays: `properties`, `incomeEntries`, `taxPayments`, `recurringBills`, and `billPayments`; settings include tax settlement options, reminder categories, and optional tax payment details. Property retains optional legacy `tenantSince` alongside agreement, expected-rent, and administrator fields. Income has `receivedAt`, `amount`, `taxableAmount`, optional `rentalMonth` and `tenantNameSnapshot`; bill and tax payments remain separate records. Tax is calculated only from confirmed taxable receipts.

## Current additions

- Property: optional rental end date and reminder offsets, expected payment day, administrator information and portal.
- Recurring bills: apartment, title, due day, optional expected amount, recipient/account, and separate manual bill-payment records; variable amounts must be checked.
- Custom reminders and persisted task interaction state: stable source/period identity, snooze/dismissal. Derived task amounts/status should not be independently authoritative.
- Tax rate, settlement, deadline and micro-account semantics are documented in `TAX_RULES.md`.

## Sources of truth

| Fact | Authority |
|---|---|
| Expected rent | Applicable apartment/period expectation |
| Actual received income | Manually confirmed receipt, actual receipt date |
| Taxable income | Validated taxable portion of confirmed receipt |
| Tax obligation | Single verified tax engine |
| Paid tax | Manually confirmed tax payments |
| Task needing attention | Projection of domain records |
| Snooze/dismissal | Persisted interaction state |
| OS notification | Disposable scheduled representation |

An apartment's **current** default rent must not silently rewrite historical expected amounts. Define an effective-date/history strategy before historical expectations are displayed.

## Migration rules

Version 1 migrates explicitly to version 2, retaining legacy `tenantSince`, tenant snapshots, income, tax payments and settings. Never reinterpret `tenantSince` as an end date. Do not silently reset corrupt/unsupported data or drop historical records. Preserve decimal-string PLN money and exact arithmetic; validate dates, IDs and references. Deleting an apartment with income history remains guarded; associated bill records are removed with the apartment.

Backup/import/export is deferred; migration safety remains mandatory without it.
