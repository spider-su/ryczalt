# Tasks and local notifications — target design

**Status:** rent, agreement, tax, recurring-bill and one-time custom reminders are projected from local records. In-app status is primary; local OS notifications are disposable projections. Guided setup and recurring custom reminders are not implemented.

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

Notification tap maps to contextual apartment/month, tax period, bill settings, agreement settings or the custom task on Pulpit. Rent quick-add prefills context but never saves until the user confirms amount and actual receipt date. Global categories plus per-apartment rent and per-bill reminder switches control OS scheduling; disabling a schedule does not hide its task from Pulpit. Denied permission leaves in-app reminders/status available. Expo Web does not schedule OS notifications. Delivery remains subject to OS scheduling constraints and needs device verification.

OS notification title/body use generic wording; never put tenant, property, bill, reminder-note, tax or payment amounts in lock-screen text. Context needed after a tap stays in the local notification data. Invalid, incomplete or unknown payloads must not navigate. These guarantees are covered by domain/mapping tests; actual OS delivery and tap behavior still require the manual Android checklist.

Tax reminders are projected from the tax calculator and outstanding manually-paid balance; changing receipts or tax payments changes the next reconciliation. Rent expectations never enter taxable income. Payment QR generation is deferred: a reliable Polish banking format and compatibility claim have not been established. Payment-detail copy actions remain available.

Custom reminders are one-time only. Monthly/yearly custom recurrence is planned, not implemented.

## Anti-spam

No blanket daily alerts for already-resolved obligations. Partial payment may change the next reminder to the remaining amount to check. Snooze suppresses repeat alerts until the selected time. A dismissed OS banner alone does not change persisted task state.
