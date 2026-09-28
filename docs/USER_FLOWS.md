# Canonical user flows

These describe implemented flows except sections explicitly labeled **target future flow**; those sections are planned behavior, not claims about current screens.

## 0. Guided setup

No apartments → Pulpit shows a short explanation and one “Dodaj mieszkanie” action → existing Settings apartment editor opens. With apartment data present, setup progress is derived from the saved address, owner rent and payment day; Pulpit offers only the next useful action and Settings opens the same editor at the corresponding field. New apartments default to payment day 5 and a lease end one year ahead; editing preserves the saved date. Optional tenant, agreement and administration details do not block required setup. Rent reminders are derived from due dates and grouped by address; there is no per-apartment reminder preference. If OS notifications are denied, tasks remain visible in Pulpit. Setup writes configuration only: it creates no income, tax-payment or bill-payment records and does not invent URLs.

## 1. Check monthly rent

Apartment has an effective expected amount and payment day → generate a stable period-specific task → local notification when appropriate → tap opens that apartment/month → user checks bank and confirms actual amount and actual receipt date → update income ledger and remaining amount to check. Partial payment keeps the task actionable; full confirmed amount resolves it. Correction/deletion re-derives task. A missing app record is not proof of arrears. Actual receipt date controls taxable income; rental month labels the expected period.

If expected rent changes, the new value applies prospectively; previous periods must preserve their earlier expected amount.

## 2. Pay rental tax

Actual taxable receipts → verified tax engine calculates obligation for the relevant period → task shows remaining amount, due date and payment details → user initiates payment outside app → user explicitly confirms payment → balance and task update. Partial payments keep remaining amount. Corrections re-derive both obligation and reminder. Never infer payment from QR generation or portal navigation.

## 3. Check administration/utility bill

Configured recurring bill and apartment → if fixed, show expected amount and total confirmed payments for the task's bill period; a partial payment leaves the remaining amount and task actionable. If variable, prompt to verify the current amount. Opening a Pulpit task or notification carries its bill period into the confirmation screen; each manually confirmed payment is recorded against that period, while its actual paid date remains today's date. Opening a link or dismissing a task does not create a payment.

## 4. Agreement expiration

Optional end date → reminders at configured offsets → tap opens apartment agreement section → user can change date on renewal, snooze, dismiss or mark task handled. Changing date cancels stale schedules; indefinite agreement has no expiration task. Legacy tenancy start is not an end date.

## 5. Personal reminder

User enters title, optional apartment, anchor date, note and recurrence: one-time, monthly or yearly → the definition is saved once, while only the current period and nearest next occurrence are projected into Pulpit and the notification plan → the user snoozes, dismisses or completes one occurrence. A later occurrence stays independent. Monthly dates use the last valid day in shorter months without changing the anchor; yearly February 29 reminders use February 28 in non-leap years and return to February 29 in leap years. Do not build a generic project-management system.

## 6. Monthly apartment overview

Select apartment/month → show expected owner rent for that period, confirmed receipts, remaining amount to check, nearby agreement/bill tasks, administration and electricity-provider portals → contextual quick actions open payment confirmation or an external portal. Media stays separate from owner rent and confirmed-income statistics.

## 7. Year-end review / PIT-28 verification — target future flow

Confirmed receipts for the selected tax year → annual taxable-income summary → tax calculated under the supported rules → confirmed tax payments totaled → annual difference shown → user verifies the figures against Twój e-PIT/PIT-28. This summary is planned for milestone 0.6/0.7 and is not implemented yet. It supports verification and recordkeeping; the app does not submit an electronic return.

## 8. Backup / restore — target future flow

Export local data to JSON → user stores the file outside the app → after reinstall/device change, select the file to restore → validate schema, dates, references and monetary values before import → show outcome and preserve the existing document if validation fails. This is planned for milestone 0.7 and is not implemented yet. No cloud backup is implied.

## Cross-cutting behavior

- Pulpit groups needs-attention, upcoming and snoozed; avoid flooding it with future recurring instances.
- Snooze moves the reminder only, never the original obligation or due date.
- OS permission denied, Web or app restart: tasks still available in-app; reconcile native schedules where supported.
- Deleting/renaming apartments and editing source records must not leave orphaned or duplicate reminders.
- Quick actions should preserve context and require user confirmation before financial writes.
- Guided setup is contextual help, not a permanent dashboard section.
