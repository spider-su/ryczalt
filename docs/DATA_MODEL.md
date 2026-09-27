# Data model and migration contract

## Current persisted schema

`RentalDocument.schemaVersion = 3`; storage key `pl.ryczalt.rental.localDocument.v1`. Collections hold apartments, confirmed income and tax/bill payments, recurring bills, property links, one-time custom reminders and task interaction state. Settings include tax settlement options, notification categories and optional tax-payment details. Properties retain optional legacy `tenantSince` and record expected rent as effective-month rates. Income stores actual `receivedAt`, received/taxable amount, optional `rentalMonth` and tenant snapshot. Tax is calculated only from confirmed taxable receipts.

## Current additions

- Property: optional rental end date and reminder offsets, expected payment day, administrator information and portal.
- Recurring bills: apartment, title, due day, optional expected amount, recipient/account, and separate manual bill-payment records; variable amounts must be checked.
- One-time custom reminders and persisted task interaction state: stable source/period identity, snooze/dismissal and explicit nonfinancial completion. Recurring custom reminders and guided setup are planned. Derived task amounts/status are never independently authoritative.
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

An apartment's **current** default rent must not silently rewrite historical expected amounts. Version 3 rent rates apply from their `YYYY-MM` effective month. For a legacy property with no rate history, the default is used only from the current month forward.

## Migration rules

Schema versions 1 and 2 migrate directly to version 3; populated fixtures cover apartment/tenant, income, tax-payment and bill history. Missing v3 collections default empty while old reminder preferences and known source records are retained. Never reinterpret `tenantSince` as an end date. Corrupt or unsupported data fails visibly rather than resetting. Preserve decimal-string PLN money and exact arithmetic; validate dates, IDs and references. Apartment deletion with income history is guarded; associated bills, payments, links and task state are removed, while personal reminders are retained without the deleted apartment association.

Backup/import/export is deferred; migration safety remains mandatory without it.
