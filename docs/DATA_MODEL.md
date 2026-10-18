# Local data contract

## POC document

`RentalDocument.schemaVersion = 1`; the current storage key is `pl.ryczalt.rental.localDocument.v2` (the previous `.v1` key is checked for namespace migration). Runtime validation rejects unsupported versions and malformed dates, references and monetary values. The document holds apartments, manually confirmed full rent and tax confirmations, task state and period snapshots.

Apartment rent terms are effective-dated by `YYYY-MM` and include owner rent, media amount/responsibility, taxable treatment and payment day. Tenant name and contact are stored on the apartment; income records keep receipt date, actual/taxable amount, optional rent month, tenant snapshot and manual/import provenance. Expected rent is never taxable income. Tax calculations use only confirmed taxable receipts and manually confirmed tax payments; excess payments carry forward.

Recurring bills use the existing `recurringBills` records (apartment, name, optional expected amount and due day); manual full payments are stored in `billPayments` with period, actual amount and payment date. Bill reminders use the existing `bills` reminder category and task-state keys. No schema change is required. Custom-reminder fields/categories may remain in old documents, but the app does not create or present custom reminders.

Initial historical rent import records one full rent receipt per selected completed month. It also records the calculated full tax obligation for each imported receipt month as an `INITIAL_IMPORT` tax payment. This represents the landlord's confirmation in the initial-rent flow; ordinary rent expectations do not create income or tax-payment records.

Tax snapshots retain `rulesYear` as the tax year and may also carry `appliedRulesYear` to identify the actual verified rules used for a provisional future-year calculation. Older exact-year snapshots may omit `appliedRulesYear`.

## Storage and backup

Rental, tenant/contact, income, tax and reminder configuration is stored locally. Android/iOS AsyncStorage values are AES-256-GCM encrypted with a random key stored through SecureStore/Keychain/Keystore; a valid legacy plaintext document is encrypted after validation on first load. The last-good recovery copy is encrypted too. Android system backup is disabled because the device-bound key is not backed up. User JSON backups remain plaintext for portability. Web storage remains browser-managed and is not app-encrypted. No backend, account sync or remote backup exists.

User-controlled JSON export/import is implemented. Exported data includes the schema version and full local document. Restore validates the file before replacing current data and leaves the current document unchanged on validation failure. Export a copy outside the app before uninstall/device change. A full export → clear/uninstall → reinstall → import → compare financial results is required POC evidence; automated JSON tests alone do not prove that device round-trip.

The app also retains a rolling last-good local snapshot for recovery from a damaged/missing primary. That snapshot is not a browseable/exportable backup and does not substitute for JSON export.

## Migration and recovery

Unknown schema versions fail visibly; corrupted storage is surfaced for deliberate recovery/reset. No payment-record deletion or schema migration is needed for this pre-installation product change. Money uses decimal strings and integer-grosz calculations; dates and IDs are validated before calculations.

## Financial sources of truth

| Fact | Authority |
|---|---|
| Expected rent | Effective apartment terms for the rental month |
| Actual income | Manually confirmed receipt and actual receipt date |
| Taxable income | Saved taxable amount on the confirmed receipt |
| Tax obligation | Versioned tax engine; provisional future-year rules are visibly identified |
| Paid tax | Manually confirmed tax-payment records |
| Task status | Projection of current domain records and task interaction state |
| OS notification | Disposable local projection, never the financial record |
