# Data model and migration contract

## Current persisted schema

`RentalDocument.schemaVersion = 7`; storage key `pl.ryczalt.rental.localDocument.v1`. Collections hold apartments, confirmed income and tax/bill payments, recurring bills, legacy property links, saved administration suggestions, one-time/monthly/yearly custom reminder definitions and task interaction state. A property uses `address`, `lifecycle`, `rentalStartDate`, `ownerRent`, `mediaAmount`, `mediaPaidByTenant`, explicit optional `taxableTreatment`, `paymentDay`, `leaseEndDate`, administration and electricity-provider details. Expected tenant rent includes media only when the tenant pays it; the explicitly selected taxable treatment determines new receipt amounts. Missing treatment after migration requires landlord confirmation. Existing receipt tax amounts are preserved during migration. Income stores `receivedAt`, received/taxable amount, optional `rentalMonth`, tenant snapshot and optional `source` (`MANUAL` or `INITIAL_IMPORT`); imported received dates are estimates and are visibly marked. Tax is calculated from confirmed taxable receipts plus an explicitly aggregate opening balance; an opening balance has no inferred monthly due date or reminder.

Android currently declares `android:allowBackup="true"`. System backup/restore depends on Android version, device configuration, and the user's backup settings; the app does not control or guarantee restore after uninstall. Settings therefore says uninstalling *may* remove these local records and recommends a separate copy. AsyncStorage is not encrypted by the app; no backup behavior was changed in schema 7.

## Current additions

- Property: address identity, `ACTIVE`/`PAUSED`/`ARCHIVED` lifecycle, owner rent, media amount/responsibility, due day, optional rental start/end, tenant details, administration and electricity-provider links. Older records default to `ACTIVE`.
- Settings: global rent reminder delay in days, defaulting to one for older records.
- Initial rent bootstrap creates a distinct confirmed income record per completed month and skips any property/month that already has a receipt. When no rent start date was entered, the selected first imported month becomes the property start and the initial effective rent month.
- Recurring bills: apartment, title, due day, optional expected amount, recipient/account, and separate manual bill-payment records; variable amounts must be checked.
- Custom reminders store a `recurrence` of `ONCE`, `MONTHLY` or `YEARLY`; recurring occurrences are derived and never stored separately. One-time IDs keep `CUSTOM_REMINDER:<id>` for backward compatibility. Recurring occurrence IDs append the occurrence date. Task interaction state (snooze/dismissal and explicit nonfinancial completion) belongs to an occurrence. Guided setup is implemented. Derived task amounts/status are never independently authoritative.
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

An apartment's **current owner rent** must not silently rewrite historical expected amounts. Rent rates apply from their `YYYY-MM` effective month. For a legacy property with no rate history, owner rent is used only from the current month forward.

## Migration rules

Schemas 1–6 migrate to schema 7. Legacy apartment `name`, `defaultMonthlyRent`, payment day and administration portal fields map to their current counterparts; a distinct former name, administrator phone/email and custom lease-end reminder lead days are appended to notes so that legacy information is not silently lost. Reminder preferences migrate to the global model: all-enabled becomes enabled, all-disabled becomes disabled, mixed or absent per-apartment preferences become disabled. The current agreement reminder uses its fixed 30-day lead; any former custom lead remains in notes, not as a claim that it was 30 days. Media defaults to `0.00`/tenant-paid false. The new optional `taxableTreatment` is left unconfirmed for old records; existing income amounts remain unchanged. Existing apartments default to `ACTIVE`, missing rent reminder delay defaults to one day, and new income source metadata remains absent on old records. Existing personal reminders receive `recurrence: ONCE`; their due dates and task IDs/states are preserved. Missing older collections default empty while known source records are retained. Never reinterpret `tenantSince` as an end date. Corrupt or unsupported data fails visibly and opens a recovery screen; the user may copy raw stored data and must explicitly confirm before reset. Invalid date and period values are rejected before domain calculations. Preserve decimal-string PLN money and exact arithmetic; validate dates, IDs and references. Apartment deletion is no longer a user-facing apartment action; pause/archive preserve history.

JSON backup/import/restore is not implemented yet and is a planned 0.7 priority. Migration safety remains mandatory now; future restore must validate schema, dates, references and monetary values before replacing or merging local records.
