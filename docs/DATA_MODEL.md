# Data model and migration contract

## Current persisted schema

`RentalDocument.schemaVersion = 3`; storage key `pl.ryczalt.rental.localDocument.v1`. Arrays include properties, confirmed income/tax/bill payments, recurring bills, categorized property links, custom reminders, and persisted task interaction states. Settings retain tax settlement options, reminder categories and optional tax payment details. Property retains optional legacy `tenantSince`; `rentSchedule` records amounts by effective month. Income has actual `receivedAt`, `amount`, `taxableAmount`, optional `rentalMonth` and `tenantNameSnapshot`. Tax is calculated only from confirmed taxable receipts.

## Current additions

- Property: optional rental end date and reminder offsets, expected payment day, administrator information and portal.
- Recurring bills: apartment, title, due day, optional expected amount, recipient/account, and separate manual bill-payment records; variable amounts must be checked.
- Custom one-time reminders and persisted task interaction state: stable source/period identity, snooze/dismissal/manual completion. Derived task amounts/status should not be independently authoritative.
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

An apartment's **current** default rent must not silently rewrite historical expected amounts. Version 3 rent rates are effective from `YYYY-MM`; when a legacy property has no rate history, its current default applies only to the current and future month.

## Migration rules

Versions 1 and 2 migrate to version 3, retaining legacy `tenantSince`, tenant snapshots, income, tax payments, reminder preferences and settings; new collections default to empty. Never reinterpret `tenantSince` as an end date. Do not silently reset corrupt/unsupported data or drop historical records. Preserve decimal-string PLN money and exact arithmetic; validate dates, IDs and references. Deleting an apartment with income history remains guarded; associated links and bill records are removed with the apartment.

Backup/import/export is deferred; migration safety remains mandatory without it.
