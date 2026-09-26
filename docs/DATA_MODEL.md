# Data model and migration contract

## Current persisted schema

`RentalDocument.schemaVersion = 1`; storage key `pl.ryczalt.rental.localDocument.v1`. Arrays: `properties`, `incomeEntries`, `taxPayments`; settings currently include `taxYear`. Current `Property` includes optional `tenantSince`; `IncomeEntry` has `receivedAt`, `amount`, `taxableAmount`, optional `rentalMonth` and `tenantNameSnapshot`; `TaxPayment` has `period`, `paidAt`, `amount`. The current tax engine is not implemented.

## Planned additions (not yet schema fields)

- Property: optional rental end date and reminder offsets, expected payment day, administrator information/portal and configurable categorized links.
- Recurring bills: apartment, title, due day, optional expected amount and verified payment details; variable amounts must be checked.
- Custom reminders and persisted task interaction state: stable source/period identity, snooze/dismissal. Derived task amounts/status should not be independently authoritative.
- If tax settings expand, document rate/settlement/micro-account semantics and their verification before implementation.

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

Never reinterpret `tenantSince` as an end date; retain legacy information even when the UI prioritizes end date. Upgrade schema explicitly with tested migrations and runtime validation. Do not silently reset corrupt/unsupported data or drop historic tenant snapshots, income or payments. Use serialized/atomic-at-app-level mutations to avoid lost writes. Preserve decimal-string PLN money and exact arithmetic; validate dates, IDs and references. Deleting an apartment with financial history must remain guarded.

Backup/import/export is deferred; migration safety remains mandatory without it.