# Tasks and local notifications — target design

**Status:** implemented for rent, agreement, tax, recurring-bill and one-time custom reminders. In-app status remains primary; local OS notifications are disposable reminders derived from local records.

## Categories

`TENANT_PAYMENT_CHECK`, `TAX_PAYMENT`, `RECURRING_BILL`, `RENTAL_AGREEMENT_END`, `CUSTOM_REMINDER`.

Stable identity: category + source ID + relevant rental/tax/bill period or agreement event. Avoid duplicate instances after restart.

## Lifecycle

- **Upcoming:** task exists but attention time has not arrived.
- **Needs attention:** due/check date reached and underlying condition unresolved.
- **Snoozed:** temporarily suppress prompts until chosen time; original due date unchanged.
- **Completed:** source condition satisfied by explicit user action (e.g., confirmed full rent/tax payment), or explicit nonfinancial task completion.
- **Dismissed:** user suppresses task; never means rent/tax/bill was paid.

Financial task completion is derived from manually confirmed records. A task may become unresolved again after correction/deletion. Do not create fictional payment entries when marking a nonfinancial check done.

## Reconciliation

Project reminders from current domain records → compare desired future notifications to scheduled stable keys/signatures → cancel obsolete and duplicate entries and schedule missing ones. Reconcile after permission grant, data/preferences changes, app restart and foreground resume. Avoid duplicates and past schedules; fire at 09:00 device-local time and recalculate on resume after timezone/DST changes. Agreement offsets are configurable (90/60/30/14/7/0 days); rent and bill due days clamp to shorter months. Apartment deletion removes its projected reminders.

## Navigation and permissions

Notification tap opens contextual apartment/month, tax period, bill settings, or the custom reminder on Pulpit. Rent quick-add prefills the remaining expected amount, but the user still confirms actual amount and receipt date. Permission is requested from settings; categories are independently configurable. Denied permission leaves in-app reminders/status available. Expo Web does not use this local scheduling path, so it stays usable without OS notifications. Delivery remains subject to OS scheduling constraints.

Tax reminders are projected from the tax calculator and outstanding manually-paid balance; changing receipts or tax payments changes the next reconciliation. Rent expectations never enter taxable income. Payment QR generation is deferred: a reliable Polish banking format and compatibility claim have not been established. Payment-detail copy actions remain available.

Recurring personal reminders are not part of the current model; custom reminders are one-time tasks with title, optional apartment, due date and note.

## Anti-spam

No blanket daily alerts for already-resolved obligations. Partial payment may change the next reminder to the remaining amount to check. Snooze suppresses repeat alerts until the selected time. A dismissed OS banner alone does not change persisted task state.
