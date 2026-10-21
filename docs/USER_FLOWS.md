# Canonical user flows — private-rental POC

## Guided setup

No apartments → Pulpit offers **“Rozpocznij · 3 kroki”** or **“Zobacz demo”**. The first action opens the focused apartment onboarding editor; apartments can subsequently be reached from the Mieszkania header action:

1. **Mieszkanie:** address (required), editable rent start date (default January 1 of the current year), and tenant name (optional).
2. **Płatności:** owner rent, separate media amount, tenant-paid media switch (on by default for new apartments), and payment day.
3. **Podatek i gotowe:** explicitly choose the taxable treatment according to the agreement, review the summary, and save.

The existing apartment save function is authoritative: it applies all normal validations, duplicate-address checks and rent schedules and persists exactly once. The wizard itself writes nothing between steps. Cancelling does not write partial data. After saving, the app initializes completed historical rent, associated tax confirmations and applicable apartment media confirmations through the preceding month. The current month remains pending. This bootstrap represents the landlord's assumed opening state; incorrect historical assumptions require user review.

Existing installations with apartments do not enter the wizard. Apartment creation/editing and advanced tenant/contact, agreement-end and administrator/utility links remain accessible from the Mieszkania header action. Calculation settings are under Podatek → Ustawienia podatku, while Dane do przelewu remains in general Settings. Demo stays isolated from real stored data.

## Confirm rent

Apartment terms → period-specific expected rent/reminder → landlord checks the bank and manually confirms the full rent and actual receipt date → income ledger updates. Delete and re-confirm corrects an unclosed record. Expected rent and tenant-paid media do not automatically become income.

## Calculate and confirm tax

Confirmed taxable receipts → versioned rules calculate period obligation and deadline → after every apartment's rent for the month is fully confirmed, the landlord pays outside the app and manually records amount/date → paid/outstanding balance updates, with overpayment carried forward. Tax payment confirmation stays unavailable while any active apartment has unknown or unconfirmed rent for that month. Editing/deleting receipts or payments recalculates the tax position. When a future year has no verified rules, the latest verified year is used provisionally and a visible warning names the rules year; the result is informational and must be checked before payment.

## Confirm apartment media charges

The **Opłaty** card totals known media charges from active apartments for the selected month. Open it to review the apartment amounts and confirm the full total after paying. The app saves one monthly confirmation and marks Opłaty as confirmed. A local reminder appears using the latest payment day among apartments with media charges, then once more the next day if still unconfirmed. There is no separate form for adding arbitrary Opłaty, and no bank transfer is initiated or inferred.

## Lease expiry

Optional lease end date → local reminder 30 days before expiry → tap opens apartment context. The landlord can edit the date, snooze or dismiss; editing the date reconciles stale notifications. No generic personal reminders workflow is included.

## Monthly apartment overview

Pulpit flow: confirm rent → confirm apartment media charges → confirm tax. The rent summary appears with apartment details; compact Opłaty and Podatek cards share a row when the screen is wide enough and stack on narrow screens. Select apartment/month for expected owner rent, confirmed receipts, amount still to check, nearby lease reminder, administration/electricity links and contextual rent confirmation. Media is separate from owner income.

## JSON backup and restore

Settings exports a validated JSON document for the user to store outside the app. After reinstall/device change, select that file; import validates it before replacing local data. Invalid backup leaves the current document unchanged. The release checklist requires clear/uninstall → reinstall → import and comparison of apartment, tenant/contact, income, tax payments, reminder settings, schema and calculated tax results. Android system backup is disabled because the native encrypted document depends on a device-bound key. Export a JSON backup before uninstalling or changing devices. No cloud backup exists.

## Cross-cutting behavior

- Native Android/iOS rental records and tenant/contact data remain local and encrypted at rest; Web storage is browser-managed and not app-encrypted. There is no backend or bank integration. User-created JSON backups are plaintext and remain under the user's control.
- Snooze changes reminder time only, never payment amount or legal deadline.
- Denied notification permission does not remove in-app tasks; native delivery/tap behavior requires physical-device verification.
- Unknown legacy custom-reminder keys are not part of the current schema-1 model and are discarded during normalization; they do not create UI, tasks or notifications. Existing supported fields remain validated.
- Electronic PIT-28 filing and annual filing submission are out of scope; displayed calculations are for information and verification.
