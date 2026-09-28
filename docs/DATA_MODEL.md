# Local data contract

## Current persisted schema

`RentalDocument.schemaVersion = 1`; storage key `pl.ryczalt.rental.localDocument.v1`. This is a fresh-install format: the app has not been installed on user devices, so no previous document schemas are accepted or converted. Every collection and setting required by the current contract must be present; an unsupported version is reported rather than guessed or normalized. Collections hold apartments, confirmed income and tax/bill payments, recurring bills, saved administration suggestions, custom reminder definitions, task interaction state, apartment-month snapshots and account-month tax snapshots. Apartment rent terms (owner rent, media amount/responsibility, taxable treatment and payment day) are effective-dated by `YYYY-MM`. Income stores `receivedAt`, received/taxable amount, optional `rentalMonth`, tenant snapshot and optional `source` (`MANUAL` or `INITIAL_IMPORT`); imported received dates are estimates and are visibly marked. Tax is calculated from confirmed taxable receipts plus an explicitly aggregate opening balance; an opening balance has no inferred monthly due date or reminder.

Android currently declares `android:allowBackup="true"`. System backup/restore depends on Android version, device configuration, and the user's backup settings; the app does not control or guarantee restore after uninstall. Settings therefore says uninstalling *may* remove these local records and recommends a separate copy. AsyncStorage is not encrypted by the app.

## Current additions

- Property: address identity, `ACTIVE`/`PAUSED`/`ARCHIVED` lifecycle, owner rent, media amount/responsibility, due day, optional rental start/end, tenant details, administration and electricity-provider links.
- Apartment lifecycle changes have an effective month. Pause/resume represents vacancy and affects expected rent only from that month. Archive is terminal soft delete: it preserves receipts and snapshots, cannot be reactivated, and offers creation of a new apartment record with a new identity.
- Closing a completed month saves an immutable apartment snapshot for each applicable apartment and a separate account-level monthly tax snapshot. Closing through a month fills missing monthly snapshots from January through that period once; later rent-setting edits do not recalculate those months. New tax payments can update the paid/outstanding fields of saved tax snapshots; existing confirmations in a closed period cannot be edited or deleted in this version. Closing never changes receipt or payment records.
- Monthly settlement is the only supported mode. Quarterly settlement is not offered.
- Historical rent import offers a default-checked “tax paid” choice. When selected, it records estimated tax-payment dates at the statutory due date and labels them as estimates; the user can uncheck the choice. If another apartment is imported for the same month, an estimated imported payment is recalculated from total account taxable income for that period. A manually recorded payment is never replaced by this assumption.
- Settings: global rent reminder delay in days, initialized to one day in new documents.
- Initial rent bootstrap creates a distinct confirmed income record per completed month and skips any property/month that already has a receipt. When no rent start date was entered, the selected first imported month becomes the property start and the initial effective rent month.
- Recurring bills: apartment, title, due day, optional expected amount, recipient/account, and separate manual bill-payment records; variable amounts must be checked.
- Custom reminders store a `recurrence` of `ONCE`, `MONTHLY` or `YEARLY`; recurring occurrences are derived and never stored separately. Every task occurrence uses `CUSTOM_REMINDER:<id>:<date>`. Task interaction state (snooze/dismissal and explicit nonfinancial completion) belongs to an occurrence. Guided setup is implemented. Derived task amounts/status are never independently authoritative.
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

An apartment's **current owner rent** must not silently rewrite historical expected amounts. Complete rent terms apply from their `YYYY-MM` effective month. Editing terms appends a new effective entry. Historical expected rent is not inferred for periods before tracking began.

## Schema and recovery

Schema 1 is validated as-is. Unsupported versions and malformed records fail visibly and open a recovery screen; the user may copy raw stored data and must explicitly confirm before reset. The rolling last-good local copy uses the same schema and is not a cross-version migration mechanism. Invalid date and period values are rejected before domain calculations. Money uses decimal strings and exact arithmetic; dates, IDs and references are validated. Apartment archive preserves history and is not a hard delete.

Manual correction of closed historical receipts, apartment snapshots and tax calculations is deliberately deferred. Until an auditable correction workflow exists, closed receipts and tax-payment confirmations are read-only; a newly confirmed tax payment may still reduce the saved outstanding balance.

JSON backup/import/restore is not implemented yet and is a planned 0.7 priority. If a released installation later needs schema upgrades, add explicit migrations before changing the persisted contract; no previous-version adapter is included now.
