# Private beta Android verification

Run this checklist on each candidate beta build. Record build commit, APK/EAS build ID, device model, Android version and date before inviting testers. An emulator pass does not replace a physical-device pass.

## Device run

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
| Rent, tax, bill and agreement notifications arrive at expected time | Not run |
| Custom one-time notification arrives; no recurrence | Not run |
| Tap each notification opens the correct screen/context | Not run |
| Snooze reschedules without changing original due date | Not run |
| Confirm/correct/delete underlying record cancels or reopens schedule correctly | Domain tests only; OS cancellation not run |
| Restart app; force-close/reopen without duplicates | Not run |
| Change timezone; verify recalculation | Not run |
| DST boundary | Not run |
| Reboot device | Not run |
| Upgrade with existing schema 1/2/3 data and preserve records | Migration tests only; device upgrade not run |

## Manual procedure

1. Install the candidate APK on a clean device and record its build/version.
2. Repeat once with notification permission denied and once granted; confirm in-app tasks remain visible in both cases.
3. Use test-only records with due times near the current time to verify each category, then tap notifications and inspect navigation context.
4. Toggle each global category, per-apartment rent switch and per-bill switch off/on; restart between runs and check for stale or duplicate OS schedules.
5. Snooze a task, confirm a payment, edit/delete a receipt, mark a bill paid, change/remove an agreement end date, and complete a custom reminder. Confirm only explicit recorded source data resolves financial tasks.
6. Force-stop/reopen, change device timezone, and reboot. Check schedule reconciliation and document Android version/OEM-specific differences.
7. Upgrade from a backup/test fixture containing schema 1, 2 or 3 data; verify rent, income, tax and bill entries remain intact.
8. Repeat the notification run on at least one physical Android device: test a fresh permission request and permission pre-granted in system settings, timed delivery, tap navigation, snooze, force-close/restart, duplicate prevention, and the expected local timezone/date. Record device, OS, timezone, build, and observed delivery timestamps.

Do not use real tenant or financial records in screenshots, logs or shared beta evidence.
