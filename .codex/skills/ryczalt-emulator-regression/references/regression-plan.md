# Repeatable Android regression plan

## Fixed test environment

- AVD: `ryczalt-api35` (`sdk_gphone64_arm64`), Android API 35, default 320×640 at 160 dpi.
- App package: `pl.ryczalt.rental`; use a fresh standalone release APK built from the current checkout, not Metro/debug.
- Primary scenario label: `QA-Parkowa`; expected monthly rent PLN 3,000; payment day 10; use the app's current month and today's actual date when entering receipts.
- Data is synthetic and stored only on the disposable emulator. No production tenant/account or backend is involved.
- Evidence folder: `artifacts/emulator-e2e/<YYYYMMDD-HHMM>-<short-commit>/`. Never reuse a prior run folder. Store screenshots and `uiautomator` dumps there; record a short results.md with case outcomes and APK SHA-256.

## Safety and reset

1. From the project root, record `git rev-parse --short HEAD`, `git status --short`, and APK checksum.
2. Run `adb devices -l`; select the booted AVD. Verify `adb -s <serial> shell getprop ro.kernel.qemu` returns `1`. If it does not, stop without installing or clearing data.
3. Verify emulator display size/density: `adb -s <serial> shell wm size` and `wm density`. If not 320×640 / 160 dpi, restore the AVD's default display configuration or record the deviation; don't silently compare screenshots across layouts.
4. Install with `adb -s <serial> install -r artifacts/app/ryczalt.apk`; then run `adb -s <serial> shell pm clear pl.ryczalt.rental`. This clears only synthetic app data on the verified emulator and establishes an empty fixture. Launch with `adb -s <serial> shell am start -W -n pl.ryczalt.rental/.MainActivity`; the explicit component launch avoids a flaky launcher/monkey handoff immediately after `pm clear`.
5. Do not clear Android-wide state, change device time, or clear data after discovering a failure. Capture evidence first. The next run starts from the same app-data reset.

Evidence commands (replace `<serial>` and `<run-dir>`):

```sh
mkdir -p <run-dir>
adb -s <serial> exec-out screencap -p > <run-dir>/<case>.png
adb -s <serial> shell uiautomator dump /sdcard/window.xml >/dev/null
adb -s <serial> pull /sdcard/window.xml <run-dir>/<case>.xml
```

## Required cases

### A. Fresh launch and safe areas

1. Launch to Pulpit after the empty-data reset; save `01-launch` evidence.
2. Verify title and content start below the Android status bar, with no doubled/excessive top gap.
3. Verify all four bottom tabs—Pulpit, Przychód, Podatek, Ustawienia—have visible icons and labels above the Android system navigation region. Confirm the bar background reaches the bottom cleanly.
4. Visit all four tabs once. Confirm no blank screen, crash, clipped title, or unusable touch target; save a screenshot of each tab.
5. On Pulpit, inspect empty/zero attention state: success copy has no dead “Pokaż” action; no future-rent flood appears.

### B. Apartment and current rent state

1. Open Ustawienia → Mieszkania and add `QA-Parkowa` with expected monthly rent `3000 zł` and payment day `10`. Leave optional tenant and account fields blank. If the form prepopulates an end date, focus the date field by tapping at the end of the displayed ISO date, then press Backspace once per character (10 times for `YYYY-MM-DD`) and verify the field is empty after dismissing the keyboard. Save. Avoid relying on cursor-end key events; they did not reliably move the caret on the API 35 AVD.
2. Verify the apartment appears in settings and its current-month unpaid state appears on Pulpit. Confirm current month / due date is plausible for the emulator's real date.
3. Capture property and dashboard evidence.

### C. Exact, partial, and multiple receipt reconciliation

1. Open Przychód → Potwierdź wpłatę. Add a `3000 zł` receipt for QA-Parkowa dated today and assigned to the current rent month. Confirm.
2. Verify the property is fully paid, remaining is `0 zł`, the current rent task is no longer active, and confirmed income history contains one receipt.
3. Edit that receipt to `1500 zł`. Verify the current expectation becomes partially paid, remaining is `1500 zł`, and the action/task remains available.
4. Add another receipt for the same property and rent month for `2000 zł`, dated today. Verify total received is `3500 zł`, expected rent is satisfied, remaining is `0 zł`, and any `500 zł` excess is shown as excess/unallocated rather than silently lost or assigned to another month.
5. Verify Pulpit and Przychód agree on totals and status. The pending-confirmation section must not list the fully paid apartment; confirmed history should show both receipts.
6. Capture evidence after exact, partial, and combined-payment states.

### D. Tax calculation and manual payment

1. Open Podatek for the same current tax year/month. For `3500 zł` taxable confirmed receipts, verify displayed obligation is `298 zł` (8.5% rounded to whole PLN), with the due date and payment state visible.
2. Confirm a `298 zł` tax payment for the displayed period.
3. Verify remaining tax is `0 zł`, the state says no tax remains to pay, and the primary payment CTA is hidden/disabled. Tax revenue remains `3500 zł`.
4. Confirm the December/Q4 annual-date behavior in domain tests; do not change emulator date to try to reach December.
5. Capture before/after tax evidence.

### E. Settings and task discoverability

1. Open Ustawienia landing page and verify category rows remain concise: Mieszkania, Podatek i rozliczenia, Dane do przelewu, Powiadomienia, Pozostałe rachunki, and Dane i kopia zapasowa (or the current equivalent labels).
2. Open tax settings and verify the spouse-threshold condition is explained; do not enable the 200k option for this rent fixture.
3. Open notification settings and verify native switches are displayed. Do not change permission or category settings during the default regression.
4. Return to Pulpit and verify there is no active rent-check task for the satisfied expectation. Inspect upcoming items separately from current actionable work.
5. Save one `QA` one-time personal reminder with a future date if that flow is present in the build; verify it appears in the upcoming/history area and does not become an immediate rent task. Skip recurrence delivery tests; no clock changes.

### F. Persistence across process restart

1. Force-stop the app with `adb -s <serial> shell am force-stop pl.ryczalt.rental`; relaunch with `adb -s <serial> shell am start -W -n pl.ryczalt.rental/.MainActivity`.
2. Revisit Pulpit, Przychód, Podatek, and Mieszkania. Verify apartment, both receipts, paid tax, and resulting statuses persist and still reconcile.
3. Save final screenshots/XML and write case results. Leave only the QA fixture in the disposable emulator; the next run resets it with `pm clear`.

## Pass criteria and reporting

Pass only when A–F all pass. File bugs with the failing case, expected/actual state, commit, APK hash, screenshot/XML path, emulator/API, and reproducible steps. Do not “fix” a failure by editing fixture data except through the described UI steps.

Report explicitly that this covers Android API 35 emulator behavior only. It does not establish physical-device safe-area behavior, notification delivery/tap reliability, Play signing, production readiness, or tax/legal correctness beyond the separately run automated/domain tests.

## Optional tests (only when specifically requested)

- Notification delivery/taps: use a separate disposable emulator snapshot/profile. Do not advance or alter the default AVD's clock; clock manipulation affects scheduled state and makes runs non-repeatable.
- Android gesture navigation: test on a dedicated AVD/configuration, record the mode and dimensions, and restore that AVD profile after the run.
- Corrupt-data recovery: inject data only on the disposable emulator after capturing a clean snapshot; preserve raw data and evidence, and never include real user data.
