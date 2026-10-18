# Rental, tax and lease reminders

**POC scope:** local reminders for expected rent, apartment media-charge confirmation, outstanding ryczałt payments and lease expiry. The media-charge reminder uses the latest configured rent payment day among active apartments with tenant-paid media charges, and repeats once the next day if still unconfirmed. It opens the aggregate Opłaty confirmation. A saved full payment cancels that period's reminder. User-created personal reminders are not available. Notifications are local and best-effort; permission, OS scheduling and delivery still require candidate-device verification.

## Categories and behavior

`TENANT_PAYMENT_CHECK`, aggregate media-charge confirmation, `TAX_PAYMENT`, and `RENTAL_AGREEMENT_END` are derived from local apartment, receipt and tax records. Stable task identities include the apartment/tax period or lease date. Rent reminders use the configured payment day and delay, group apartments with the same due date, and never imply debt: the landlord manually confirms receipts. Media reminders derive from apartment terms and one manually confirmed full monthly payment. Tax reminders derive from calculated obligations and manually recorded payments. Lease reminders use a 30-day lead.

Upcoming, needs-attention, snoozed, completed and dismissed are task presentation states. Rent/tax completion only follows saved financial records; snooze/dismiss never means paid. Editing or deleting a receipt/payment can reopen the corresponding task.

## Scheduling, permissions and privacy

The app reconciles desired local notifications against OS-scheduled stable keys after a document is committed, permission changes, app restart and foreground resume. Reconciliation is serialized and reads the latest committed document; failed persistence does not publish a document change. Demo mode skips OS reconciliation. A normalized plan collapses exact duplicates and rejects conflicting keys before OS mutations. Reconciliation keeps one matching pending notification per logical key, cancels duplicate/obsolete schedules, and schedules missing or changed entries. Failures report a safe operation category and retry on the next committed change or app resume. Notifications use generic lock-screen text; tenant names, addresses, income, tax amounts and payment details stay out of the title/body. Navigation context remains in local notification data.

Android ensures its reminder channel at startup independently of notification permission. Denied permission leaves in-app tasks available. Permission can be granted through the in-app flow or Android settings. Delivery, tap routing, snooze, restart/reboot and revoke/regrant behavior require physical Android verification for each release candidate; see [the Android checklist](PRIVATE_BETA_ANDROID_CHECKLIST.md). OS delivery is not guaranteed by unit tests.

In development builds and demo mode, Settings exposes an explicit **Test za 5 min** action. It schedules one isolated local notification without modifying rental data or the normal derived reminder plan. The test notification is intentionally not owned by reconciliation, so it is suitable for verifying OS delivery on a device.

## Boundaries

Rent due days clamp to shorter months; reminders use 09:00 device-local time and reconcile after timezone changes/resume. Timezone/DST behavior is not exhaustively certified for the POC. Expo Web does not schedule native OS notifications. Tax amounts remain informational and should be checked before payment, especially when the tax screen marks a future year provisional. No backend or remote notification service is used.
