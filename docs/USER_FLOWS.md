# Canonical user flows

These are **target flows** for implementation and acceptance testing, not claims of currently available screens.

## 1. Check monthly rent

Apartment has expected amount and payment day → generate a stable period-specific task → local notification when appropriate → tap opens that apartment/month → user checks bank and confirms actual amount and actual receipt date → update income ledger and remaining amount to check. Partial payment keeps the task actionable; full confirmed amount resolves it. Correction/deletion re-derives task. A missing app record is not proof of arrears. Actual receipt date controls taxable income; rental month labels the expected period.

## 2. Pay rental tax

Actual taxable receipts → verified tax engine calculates obligation for the relevant period → task shows remaining amount, due date and payment details → user initiates payment outside app → user explicitly confirms payment → balance and task update. Partial payments keep remaining amount. Corrections re-derive both obligation and reminder. Never infer payment from QR generation or portal navigation.

## 3. Check administration/utility bill

Configured recurring bill and apartment → reminder to verify current amount (especially variable bills) → optional administrator/utility portal link → user checks bill and pays externally → explicit payment confirmation if tracking exists, otherwise clearly labeled “Oznacz jako załatwione” without fabricating a bank transaction. Opening link does not resolve task.

## 4. Agreement expiration

Optional end date → reminders at configured offsets → tap opens apartment agreement section → user can change date on renewal, snooze, dismiss or mark task handled. Changing date cancels stale schedules; indefinite agreement has no expiration task. Legacy tenancy start is not an end date.

## 5. Custom reminder

User enters title, optional apartment, due date and note → appears in Pulpit and may schedule local notification → user snoozes or completes it. Do not build a generic project-management system.

## Cross-cutting behavior

- Pulpit groups needs-attention, upcoming and snoozed; avoid flooding it with future recurring instances.
- Snooze moves the reminder only, never the original obligation or due date.
- OS permission denied, Web or app restart: tasks still available in-app; reconcile native schedules where supported.
- Deleting/renaming apartments and editing source records must not leave orphaned or duplicate reminders.
- Quick actions should preserve context and require user confirmation before financial writes.