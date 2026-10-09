# Private beta Android verification

Run this checklist on each candidate beta build. Record build commit, APK/EAS build ID, device model, Android version and date before inviting testers. An emulator pass does not replace a physical-device pass.

## Latest candidate evidence

Candidate commit/artifact: pending. The emulator and code checks in this working session are not a released candidate or evidence of the full landlord happy path. Physical Android device: unavailable in the current environment (ADB exposes only an emulator), so notification delivery/tap/reboot/permission-cycle gates remain open.

POC data boundary: rental, tenant/contact, income, tax payments and reminder settings are stored locally in AsyncStorage without app-level encryption. Android `allowBackup` is enabled, but OS backup/restore depends on device/version/user settings and is not guaranteed. User-controlled JSON export/import is implemented; the required clear-data/reinstall round-trip is still a release gate.

## Historical device run

Latest recorded emulator: Android Studio AVD `ryczalt-api35`, model `sdk_gphone64_arm64`, Android API 35, AArch64, package `pl.ryczalt.rental`. On 2026-09-27, a local debug APK was installed and launched with Metro; all tabs and core local flows were manually exercised. This emulator evidence predates the current POC hardening changes and is not evidence for their runtime behavior. No physical Android device has been verified for this candidate.

Hardening build smoke check: on 2026-09-27, rebuilt/installed the debug APK with JDK 17 and launched it on the same API 35 emulator. The app reached Pulpit with no fresh fatal/React Native errors. After clearing only this app's local data and denying `POST_NOTIFICATIONS`, app startup created the `reminders` notification channel. This verifies startup channel creation on an emulator only; it does not verify delivery or physical-device behavior.

The same emulator run injected malformed AsyncStorage JSON into the rental document key. The recovery screen showed the invalid-JSON reason, copied the raw value on request, kept the error screen after canceling confirmation, and returned to Pulpit only after confirming reset. This was disposable emulator data; no real user data was used.

| Check | Result |
| --- | --- |
| Fresh install and launch | Passed on API 35 emulator, 2026-09-27 |
| Deny notification permission; in-app tasks remain available | Fresh install had permission not granted; settings were accessible; task retention with populated records not exercised on device |
| Request notification permission on physical device | Not run; an earlier emulator run granted permission |
| Launch with notification permission already granted in system settings on physical device | Not run |
| Android startup creates reminder channel independently of permission | Passed on API 35 emulator with `POST_NOTIFICATIONS` denied; pre-granted system-settings state not verified |
| Rent, tax and agreement notifications arrive at expected time | Not run on physical device |
| Tap each notification opens the correct screen/context | Not run |
| Snooze reschedules without changing original due date | Not run |
| Confirm/correct/delete underlying record cancels or reopens schedule correctly | Domain tests only; OS cancellation not run |
| Restart app; force-close/reopen without duplicates | Not run |
| Change timezone; verify recalculation | Not run |
| DST boundary | Not run |
| Reboot device | Not run |
| Legacy document with bill/custom-reminder fields loads without crash/data loss | Automated compatibility test; candidate device upgrade not run |
| Fresh install/restart with current local schema | Historical emulator evidence only; rerun against RC candidate |
| Recover a damaged/missing primary from last-good local snapshot and show recovery notice | Automated storage tests; device recovery flow not yet run |
| Both primary and backup damaged: retain recovery screen and offer explicit raw-data handling/reset | Automated storage tests cover preserving corruption error; device flow not yet run |
| Tax status and deadline around Warsaw midnight, DST, weekend/public holiday, and December/Q4 January deadline | Domain tests only; device timezone/DST run not done |
| Verify exact-year rules and visibly provisional future-year fallback | Focused automated tests; candidate UI verification pending |
| JSON backup export → clear/uninstall → reinstall → import | Automated format validation only; device round-trip not run |
| Restored apartments, tenant/contact, income, tax payments, reminders, schema and tax results | Not run |

## POC happy-path checklist

On a clean candidate install, record apartment/address, owner income, media amount and paid-by-tenant flag, tenant/contact, lease end, rent day and reminder settings. Confirm full and partial rent, dashboard totals, selected tax period, tax payment, overpayment carry-forward, restart persistence, apartment/payment edits and deletion/correction with recalculated tax. Then complete the JSON backup round-trip above and compare restored derived tax/reminder results. No result is claimed until recorded against a build SHA.

## Manual procedure

1. Install the candidate APK on a clean device and record its build/version.
2. Repeat once with notification permission denied and once granted; confirm in-app tasks remain visible in both cases.
3. Use test-only records with due times near the current time to verify each category, then tap notifications and inspect navigation context.
4. Toggle rent, tax and agreement reminder settings. Rent reminders derive from payment days and group apartments sharing a due date. Restart between runs and check for stale or duplicate OS schedules.
5. Snooze a supported task, confirm a payment, edit/delete a receipt and change/remove an agreement end date. Confirm only explicit recorded source data resolves financial tasks.
6. Force-stop/reopen, change device timezone, and reboot. Check schedule reconciliation and document Android version/OEM-specific differences.
7. Import a legacy local document containing removed bill/custom-reminder fields and verify apartment, income and tax data remains usable; verify the legacy fields do not reappear in UI/tasks.
8. Repeat the notification run on at least one physical Android device: test a fresh permission request and permission pre-granted in system settings, timed delivery, tap navigation, snooze, force-close/restart, duplicate prevention, and the expected local timezone/date. Record device, OS, timezone, build, and observed delivery timestamps.

## Duplicate-notification regression procedure

Run on a clean candidate APK on a physical Android device and record the APK SHA, app version, device model, Android version, locale and timezone. Do not mark this check passed from a JS bundle export or emulator run.

1. Grant notification permission. Create test-only rental data that produces an upcoming grouped rent reminder, a tax deadline reminder and an agreement-expiration reminder. Confirm each notification tap opens its existing rent, tax or agreement context.
2. Inspect the app's OS pending list with `Notifications.getAllScheduledNotificationsAsync()` (use a temporary local diagnostic build or debugger inspection). For each item, record `identifier`, `content.data.reminderKey`, `content.data.signature`, and trigger. Count by `reminderKey`: each key must occur once. Do not count Expo's generated `identifier` as the logical identity.
3. Force-stop and reopen the app several times, including reopening after a device reboot. Reinspect the pending list after every launch. The same logical keys should remain at count one.
4. Confirm a rent payment, correct its amount/date, change rent reminder delay, disable and re-enable rent/tax/agreement categories, snooze a task, and change a lease end date. Reinspect after each change; obsolete keys should be absent and each still-desired key should occur once.
5. Verify grouping: apartments sharing a due date have one group key and no corresponding individual rent notifications. Change one apartment's due date and confirm groups split without stale schedules.
6. Cause a local cancellation or scheduling attempt to fail in a diagnostic build, then restore normal operation and trigger reconciliation. Verify retries converge to one pending schedule per key without canceling unrelated app notifications.
7. Allow each category's notification time to arrive and record actual alert count and delivery timestamps. Pending schedule count and delivered alert count are separate observations: a single pending schedule can still be delivered twice by OS/vendor behavior, while a duplicate alert alone does not prove two pending schedules.
8. Tap each delivered alert and confirm navigation. Record pending-list snapshots and delivery observations separately in the table above; leave device-only checks marked not run until observed on hardware.

Do not use real tenant or financial records in screenshots, logs or shared beta evidence.
