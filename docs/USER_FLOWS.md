# Canonical user flows

These describe the implemented flows on `develop`. Guided setup/checklist is planned but not implemented.

## 1. Check monthly rent

Apartment has an effective expected amount and payment day → generate a stable period-specific task → local notification when appropriate → tap opens that apartment/month → user checks bank and confirms actual amount and actual receipt date → update income ledger and remaining amount to check. Partial payment keeps the task actionable; full confirmed amount resolves it. Correction/deletion re-derives task. A missing app record is not proof of arrears. Actual receipt date controls taxable income; rental month labels the expected period.

If expected rent changes, the new value applies prospectively; previous periods must preserve their earlier expected amount.

## 2. Pay rental tax

Actual taxable receipts → verified tax engine calculates obligation for the relevant period → task shows remaining amount, due date and payment details → user initiates payment outside app → user explicitly confirms payment → balance and task update. Partial payments keep remaining amount. Corrections re-derive both obligation and reminder. Never infer payment from QR generation or portal navigation.

## 3. Check administration/utility bill

Configured recurring bill and apartment → if fixed, show expected amount; if variable, prompt to verify current amount → optional administrator/utility portal link → user pays externally → manually records the actual bill payment. The task resolves only from that bill-payment record. Opening a link or dismissing a task does not create a payment.

## 4. Agreement expiration

Optional end date → reminders at configured offsets → tap opens apartment agreement section → user can change date on renewal, snooze, dismiss or mark task handled. Changing date cancels stale schedules; indefinite agreement has no expiration task. Legacy tenancy start is not an end date.

## 5. Personal reminder

User enters title, optional apartment, due date and note → one-time reminder appears in Pulpit and may schedule a local notification → user snoozes, completes or dismisses it. Recurrence is planned, not implemented.

## 6. Monthly apartment overview

Select apartment/month → show expected rent for that period, confirmed receipts, remaining amount to check, nearby agreement/bill tasks and useful links → contextual quick actions open payment confirmation or external portal. Do not mix expected rent into confirmed-income statistics.

## Cross-cutting behavior

- Pulpit groups needs-attention, upcoming and snoozed; avoid flooding it with future recurring instances.
- Snooze moves the reminder only, never the original obligation or due date.
- OS permission denied, Web or app restart: tasks still available in-app; reconcile native schedules where supported.
- Deleting/renaming apartments and editing source records must not leave orphaned or duplicate reminders.
- Quick actions should preserve context and require user confirmation before financial writes.
- A future guided setup should be temporary and must not become a permanent dashboard section.
