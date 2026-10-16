# Canonical user flows — private-rental POC

## Guided setup

No apartments → Pulpit offers **“Rozpocznij · 3 kroki”** or **“Zobacz demo”**. The first action opens the same Settings apartment editor in a focused onboarding mode:

1. **Mieszkanie:** address (required) and tenant name (optional).
2. **Płatności:** owner rent, separate media amount, tenant-paid media switch, and payment day.
3. **Podatek i gotowe:** explicitly choose the taxable treatment according to the agreement, review the summary, and save.

The existing apartment save function is authoritative: it applies all normal validations, duplicate-address checks and rent schedules and persists exactly once. The wizard itself writes nothing between steps. Cancelling does not write partial data. When the apartment is saved, the modal closes and Pulpit uses the real document. No income, tax payment, invented date or confirmed transfer is created automatically. The landlord confirms actual receipts later. A high-amount warning is retained.

Existing installations with apartments do not enter the wizard. Manual apartment creation/editing and advanced tenant/contact, agreement-end, administrator/utility links and historical-income bootstrap remain accessible in Settings. Demo stays isolated from real stored data.

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
