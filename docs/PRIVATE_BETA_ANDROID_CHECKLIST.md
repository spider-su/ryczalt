# Private beta Android verification

Run this checklist on each candidate beta build. Record build commit, APK/EAS build ID, device model, Android version and date before inviting testers. An emulator pass does not replace a physical-device pass.

## Device run

Latest recorded emulator: Android Studio AVD `ryczalt-api35`, model `sdk_gphone64_arm64`, Android API 35, AArch64, package `pl.ryczalt.rental`; clean native build commit is this follow-up working tree (APK SHA/build metadata can be captured at release). On 2026-09-27, clean-installed the fresh debug APK, launched it with Metro, and manually opened all four tabs: Pulpit, Przychód, Podatek and Ustawienia. Inspected the notification settings and the empty-state property form (`Nowe mieszkanie`); app stayed foregrounded with no crash. Android notification permission was not granted on this fresh install; in-app notification settings remained available. Earlier run granted permission, but only core screens/forms were inspected then. Neither run verified actual timed OS delivery or notification taps.

| Check | Result |
| --- | --- |
| Fresh install and launch | Passed on API 35 emulator, 2026-09-27 |
| Deny notification permission; in-app tasks remain available | Fresh install had permission not granted; settings were accessible; task retention with populated records not exercised on device |
| Grant notification permission | Granted in earlier emulator run; not rechecked on this clean install |
| Rent, tax, bill and agreement notifications arrive at expected time | Not run |
| Custom one-time notification arrives; no recurrence | Not run |
| Tap each notification opens the correct screen/context | Not run |
| Snooze reschedules without changing original due date | Not run |
| Confirm/correct/delete underlying record cancels or reopens schedule correctly | Domain tests only; OS cancellation not run |
| Restart app; force-close/reopen without duplicates | Not run |
| Change timezone; verify recalculation | Not run |
| DST boundary | Not run |
| Reboot device | Not run |
| Upgrade with existing schema 1/2 data and preserve records | Migration tests only; device upgrade not run |

## Manual procedure

1. Install the candidate APK on a clean device and record its build/version.
2. Repeat once with notification permission denied and once granted; confirm in-app tasks remain visible in both cases.
3. Use test-only records with due times near the current time to verify each category, then tap notifications and inspect navigation context.
4. Toggle each global category, per-apartment rent switch and per-bill switch off/on; restart between runs and check for stale or duplicate OS schedules.
5. Snooze a task, confirm a payment, edit/delete a receipt, mark a bill paid, change/remove an agreement end date, and complete a custom reminder. Confirm only explicit recorded source data resolves financial tasks.
6. Force-stop/reopen, change device timezone, and reboot. Check schedule reconciliation and document Android version/OEM-specific differences.
7. Upgrade from a backup/test fixture containing schema 1 or 2 data; verify rent, income, tax and bill entries remain intact.

Do not use real tenant or financial records in screenshots, logs or shared beta evidence.
