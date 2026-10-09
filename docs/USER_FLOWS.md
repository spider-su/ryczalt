# Canonical user flows — private-rental POC

## Guided setup

No apartments → Pulpit offers “Dodaj mieszkanie” → Settings collects address, owner rent, media amount/responsibility, tenant/contact, lease end, expected rent day and rent-reminder settings. The landlord chooses taxable treatment according to the rental agreement. Setup writes no income or tax payments and invents no contractual dates.

## Confirm rent

Apartment terms → period-specific expected rent/reminder → landlord checks the bank and manually confirms actual received amount/date → income ledger and remaining amount update. Partial payment stays actionable; sufficient receipts resolve the period. Edit/delete recalculates dashboard and tax. Expected rent and tenant-paid media do not automatically become income.

## Calculate and confirm tax

Confirmed taxable receipts → versioned rules calculate period obligation and deadline → landlord pays outside the app and manually records amount/date → paid/outstanding balance updates, with overpayment carried forward. Editing/deleting receipts or payments recalculates the tax position. When a future year has no verified rules, the latest verified year is used provisionally and a visible warning names the rules year; the result is informational and must be checked before payment.

## Lease expiry

Optional lease end date → local reminder 30 days before expiry → tap opens apartment context. The landlord can edit the date, snooze or dismiss; editing the date reconciles stale notifications. No generic personal reminder or bills workflow is included.

## Monthly apartment overview

Select apartment/month → expected owner rent, confirmed receipts, amount still to check, nearby lease reminder, administration/electricity links and contextual rent confirmation. Media is separate from owner income.

## JSON backup and restore

Settings exports a validated JSON document for the user to store outside the app. After reinstall/device change, select that file; import validates it before replacing local data. Invalid backup leaves the current document unchanged. The release checklist requires clear/uninstall → reinstall → import and comparison of apartment, tenant/contact, income, tax payments, reminder settings, schema and calculated tax results. Android system backup may also restore AsyncStorage but is device/settings dependent and not guaranteed. No cloud backup exists.

## Cross-cutting behavior

- Native Android/iOS rental records and tenant/contact data remain local and encrypted at rest; Web storage is browser-managed and not app-encrypted. There is no backend or bank integration. User-created JSON backups are plaintext and remain under the user's control.
- Snooze changes reminder time only, never payment amount or legal deadline.
- Denied notification permission does not remove in-app tasks; native delivery/tap behavior requires physical-device verification.
- Existing documents containing removed bill/custom-reminder fields remain loadable, but those fields do not create UI, tasks or notifications.
- Electronic PIT-28 filing and annual filing submission are out of scope; displayed calculations are for information and verification.
