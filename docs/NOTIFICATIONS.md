# Tasks and local notifications — target design

**Status:** planned. The inspected baseline does not yet contain a native notification implementation. Persistent in-app tasks are the primary UX; local OS notifications are reminders about them, not the task database.

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

Project tasks from current domain records → apply persisted snooze/dismissal → compare desired future native notifications to scheduled IDs → cancel obsolete and schedule missing. Reconcile after load, relevant mutation and preference changes. Avoid duplicates and past schedules; use a reasonable local hour and test timezones/DST, end-of-month days and changed agreement dates. Reschedule on apartment deletion where permitted.

## Navigation and permissions

Notification tap opens contextual apartment/month, tax period, bill/portal or agreement settings. Prefilled forms never auto-save money. Request permission contextually, allow category toggles and keep in-app tasks fully functional if denied or on Web. Do not promise guaranteed delivery when the app is terminated or OS scheduling is constrained.

## Anti-spam

No blanket daily alerts for already-resolved obligations. Partial payment may change the next reminder to the remaining amount to check. Snooze suppresses repeat alerts until the selected time. A dismissed OS banner alone does not change persisted task state.