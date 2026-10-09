# Local data contract

## POC document

`RentalDocument.schemaVersion = 1`; the current storage key is `pl.ryczalt.rental.localDocument.v2` (the previous `.v1` key is checked for one-time migration). Runtime validation rejects unsupported versions and malformed dates, references and monetary values. The document holds apartments, manually confirmed income and tax payments, task state, apartment-month snapshots and tax-settlement snapshots.

Apartment rent terms are effective-dated by `YYYY-MM` and include owner rent, media amount/responsibility, taxable treatment and payment day. Tenant name and contact are stored on the apartment; income records keep receipt date, actual/taxable amount, optional rent month, tenant snapshot and manual/import provenance. Expected rent is never taxable income. Tax calculations use only confirmed taxable receipts and manually confirmed tax payments; excess payments carry forward.

For legacy compatibility, schema-1 documents/backups may still contain recurring-bill, bill-payment and custom-reminder fields/categories. Validation preserves those values, while the current POC neither creates nor presents them and task/notification generation ignores them. Stale task states for those removed categories are harmless.

Tax snapshots retain `rulesYear` as the tax year and may also carry `appliedRulesYear` to identify the actual verified rules used for a provisional future-year calculation. Older exact-year snapshots may omit `appliedRulesYear`.

## Storage and backup

Rental, tenant/contact, income, tax and reminder configuration is stored locally. Android/iOS AsyncStorage values are AES-256-GCM encrypted with a random key stored through SecureStore/Keychain/Keystore; a valid legacy plaintext document is encrypted after validation on first load. The last-good recovery copy is encrypted too. Android system backup is disabled because the device-bound key is not backed up. User JSON backups remain plaintext for portability. Web storage remains browser-managed and is not app-encrypted. No backend, account sync or remote backup exists.

User-controlled JSON export/import is implemented. Exported data includes the schema version and full local document. Restore validates the file before replacing current data and leaves the current document unchanged on validation failure. Export a copy outside the app before uninstall/device change. A full export → clear/uninstall → reinstall → import → compare financial results is required POC evidence; automated JSON tests alone do not prove that device round-trip.

The app also retains a rolling last-good local snapshot for recovery from a damaged/missing primary. That snapshot is not a browseable/exportable backup and does not substitute for JSON export.

## Migration and recovery

Compatible existing schema-1 documents, including legacy removed-feature fields, load without data loss or feature reappearance. An incompatible/unknown schema fails visibly; do not silently reset or normalize. Before any incompatible schema change after distribution, add an explicit versioned migration and test a real prior-version fixture. Corrupted storage is surfaced for deliberate recovery/reset. Money uses decimal strings and integer-grosz calculations; dates and IDs are validated before calculations.

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
