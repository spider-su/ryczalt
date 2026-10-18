# Repeatable Android regression plan

## Fixed test environment

- AVD: `ryczalt-api35` (`sdk_gphone64_arm64`), Android API 35, default 320×640 at 160 dpi.
- App package: `pl.ryczalt.rental`; use a fresh standalone release APK built from the current checkout, not Metro/debug.
- Primary synthetic apartment: `QA-Parkowa`.
- Synthetic tenant: `Jan Testowy`, phone `500600700`, email `jan.testowy@example.invalid`.
- Owner rent: PLN 3,000/month.
- Media/charges: PLN 500/month, initially marked as paid by tenant.
- Payment day: 10.
- Taxable treatment: `OWNER_RENT` unless a case explicitly says otherwise.
- Use the app's current month and the emulator's real date. Never change the emulator clock to force a due date.
- No production tenant/account/backend data is used.
- Evidence folder: `artifacts/emulator-e2e/<YYYYMMDD-HHMM>-<short-commit>/`. Store screenshots, UI dumps and `results.md`; never reuse a prior run folder.

## Safety and reset

1. Record `git rev-parse --short HEAD`, `git status --short`, APK SHA-256 and current branch.
2. Run `adb devices -l`; verify the selected target is the disposable emulator with `adb -s <serial> shell getprop ro.kernel.qemu` returning `1`.
3. Verify `wm size` = 320×640 and `wm density` = 160, or record the deviation.
4. Install the fresh APK, then clear **only** this app's data with `adb -s <serial> shell pm clear pl.ryczalt.rental`.
5. Launch with `adb -s <serial> shell am start -W -n pl.ryczalt.rental/.MainActivity`.
6. Do not clear app data again after a failure until evidence is captured.
7. Do not change device time. Notification timing must use the real emulator clock.

Evidence commands:

```sh
mkdir -p <run-dir>
adb -s <serial> exec-out screencap -p > <run-dir>/<case>.png
adb -s <serial> shell uiautomator dump /sdcard/window.xml >/dev/null
adb -s <serial> pull /sdcard/window.xml <run-dir>/<case>.xml
```

## Required cases

### A. Fresh launch, safe areas, demo isolation and notification smoke test

1. Launch from empty storage and capture `01-fresh-pulpit`.
2. Verify:
   - Pulpit renders below the status bar;
   - the three primary tabs (Pulpit, Podatek, Ustawienia) are visible above system navigation;
   - no blank screen/crash/clipped title;
   - empty Pulpit offers **Rozpocznij · 3 kroki** and **Zobacz demo**.
3. Visit the three primary tabs once before creating data and capture one screenshot per tab. Confirm `Historia wpłat` is reachable from Pulpit rather than shown as a fourth tab.
4. Tap **Zobacz demo**.
5. Verify the demo banner appears and explicitly says demo changes are not persisted.
6. In demo mode open Ustawienia → Powiadomienia.
7. If permission is not already granted, use the in-app enable flow. Confirm the Android reminder channel exists.
8. Verify the diagnostic card is visible in demo mode and tap **Test za 5 min**.
9. Confirm the app reports that the test was scheduled. Record the exact tap time.
10. While waiting, inspect notification category switches, turn one category off and back on, and verify the UI state changes without altering real stored data.
11. Wait for the test notification without changing the clock. Confirm exactly one **Test przypomnienia** notification arrives roughly five minutes later and capture notification-shade evidence.
12. Return to the app. The diagnostic notification has no domain navigation target, so only verify that the app remains usable.
13. Tap **Wyjdź z demo** and verify the real document is still empty.
14. Capture `02-demo-notification` and `03-demo-exit-empty`.

Failure criteria: demo changes persist into real data, the test is unavailable in demo, multiple diagnostic notifications arrive from one tap, or scheduling requires changing rental facts.

### B. Guided onboarding — all wizard controls

1. On empty Pulpit tap **Rozpocznij · 3 kroki**.
2. Step 1:
   - tap **Dalej** with an empty address and verify inline validation;
   - enter address `QA-Parkowa`;
   - enter tenant name `Jan Testowy`;
   - tap **Pomiń na razie** once, confirm the wizard closes, and verify no apartment was created.
3. Reopen **Rozpocznij · 3 kroki** and re-enter the Step 1 values.
4. Tap **Dalej**.
5. Step 2:
   - enter owner rent `3000`;
   - enter media `500`;
   - switch **Media płaci najemca** on;
   - enter payment day `10`;
   - enter an invalid day such as `32`, tap **Dalej**, and verify validation;
   - restore `10`.
6. Tap **Wstecz** and verify Step 1 values are retained, then **Dalej** again and verify Step 2 values are retained.
7. Step 3:
   - verify both tax-treatment radio choices render;
   - select **Czynsz i opłaty dodatkowe**, then switch to **Tylko czynsz dla właściciela** to exercise both;
   - verify the summary shows address, tenant, 3000 rent, 500 media and day 10.
8. Tap **Zapisz mieszkanie**.
9. Verify Pulpit now shows the apartment and no receipt/tax payment was manufactured automatically.
10. Capture `04-onboarding-step1`, `05-onboarding-step2`, `06-onboarding-summary`, `07-onboarding-saved`.

### C. Normal apartment editor and advanced fields

Use the regular Ustawienia → Mieszkania editor after onboarding; this verifies the wizard and normal form stay aligned.

1. Open `QA-Parkowa`.
2. Verify owner rent = 3000, media = 500, media-paid-by-tenant = on, payment day = 10, taxable treatment = owner rent only.
3. Exercise and save these additional fields:
   - tenant phone `500600700`;
   - tenant email `jan.testowy@example.invalid`;
   - rental start date = a valid date not later than today;
   - lease end date = a valid future date;
   - administration name = `QA Administracja`;
   - administration URL = `https://example.invalid/admin`;
   - electricity provider = any available preset/manual value;
   - electricity URL = `https://example.invalid/power`;
   - notes = `QA emulator regression`.
4. If an advanced/disclosure control is collapsed, expand and collapse it once before saving.
5. Exercise one validation path:
   - enter an invalid non-HTTPS URL or malformed date;
   - verify save is blocked/feedback appears;
   - restore the valid value.
6. Save and reopen the apartment; verify all values persist.
7. If archive/pause lifecycle controls are present, inspect them but do not archive the sole QA apartment before completing income/tax cases.
8. Capture `08-apartment-advanced`.

### D. Rent confirmation, edit, partial payment, excess and deletion

Use the current rental month. Do not move the emulator date.

1. From Pulpit tap the `QA-Parkowa` apartment card to open the individual quick-add flow.
2. Confirm a first receipt:
   - amount `3000`;
   - payment date is implicit and saved as today (there is no editable payment-date field);
   - rental month = current month;
   - taxable amount should default according to `OWNER_RENT`.
3. Verify:
   - Pulpit shows the rent satisfied;
   - Przychód contains one confirmed receipt;
   - remaining expected owner rent is 0.
4. Open the saved receipt and edit it to `1500`.
5. Verify the apartment becomes partial and `1500` remains to confirm.
6. Add a second receipt for `2000` for the same property/month.
7. Verify total gross receipts = 3500, contractual owner rent is satisfied, and the extra 500 is shown as excess/unallocated rather than silently moved.
8. Verify under `OWNER_RENT` the default taxable total remains capped at 3000.
9. Exercise receipt correction controls:
   - open the second receipt;
   - change a harmless editable field and save;
   - use **Usuń** and cancel once;
   - invoke **Usuń** again and confirm deletion;
   - verify the apartment returns to partial;
   - add the 2000 receipt again so later tax steps use the intended fixture.
10. If the current date is on/after the payment due date and bulk confirmation is offered, open the bulk sheet, inspect selection/date controls and close without creating a duplicate receipt. Before due date, record the bulk flow as legitimately unavailable.
11. Capture `09-rent-full`, `10-rent-partial`, `11-rent-excess`.

### E. Tax calculation and tax-payment form cycle

1. Open Podatek for the current period.
2. Verify the saved taxable revenue is 3000 zł under the default `OWNER_RENT` fixture despite 3500 zł gross receipts.
3. Verify the obligation is 255 zł (8.5% of 3000, rounded according to the domain rules).
4. Expand **Rok <year>**, verify annual taxable income / threshold / remaining-threshold details, then collapse it.
5. Expand and collapse **Jak liczymy podatek?**.
6. While tax is outstanding, open **Dane do przelewu**; exercise copy actions for any populated transfer details and close.
7. Tap **Potwierdź wykonaną wpłatę**.
8. If the first-payment history-review modal appears, inspect its values, close it once, reopen, then continue.
9. Enter the actual tax payment amount/date and save.
10. Verify the hero becomes **Opłacone**, remaining tax is 0, and the transfer-details row is no longer promoted in the paid state.
11. Expand **Historia płatności (1)** and verify the saved payment date/amount.
12. Use **Usuń** and cancel once; invoke **Usuń** again and confirm; verify tax becomes outstanding again; re-add the intended payment so persistence checks finish in a paid state.
13. If overpayment can be entered in the current form, record one amount above the obligation, verify the displayed overpayment/carry-forward state, then restore the intended fixture or clearly record the resulting state used for F–H.
14. Capture `12-tax-before-payment`, `13-tax-payment-form`, `14-tax-paid`.

### F. Settings coverage

Exercise every current Settings section at least once. The expected POC sections are the current equivalents of:

- Mieszkania;
- Podatek i rozliczenia;
- Dane do przelewu;
- Powiadomienia;
- Dane i kopia zapasowa.

Removed bills/custom-reminder sections must **not** reappear.

1. Tax settings:
   - open spouse-threshold explanation;
   - leave the 200k option disabled for the fixture;
   - inspect tax year/settlement controls;
   - enter opening balances only if doing so will not invalidate the current fixture; otherwise verify controls and document why they are not modified.
2. Transfer settings:
   - enter an invalid micro-account and verify validation;
   - leave the field empty afterward unless a synthetic valid fixture is deliberately supplied.
3. Notifications:
   - verify permission state;
   - exercise rent-delay choices and return to the intended value;
   - toggle each rent/agreement/tax category off and back on;
   - verify upcoming reminder list remains coherent;
   - if the build is dev/demo-enabled at this point, the **Test za 5 min** control may be smoke-tested again, but do not require a second five-minute wait.
4. Data:
   - open backup/recovery information;
   - verify plaintext-backup/privacy wording is visible;
   - do not reset data before the backup case.
5. Return to Pulpit and verify no removed personal-reminder/bill UI is present.
6. Capture `15-settings-tax`, `16-settings-notifications`, `17-settings-data`.

### G. JSON backup → clear data → restore round trip

This case is destructive but safe on the verified disposable emulator and runs only after A–F evidence is complete.

1. Ustawienia → Dane i kopia zapasowa → **Utwórz kopię danych**.
2. Complete the Android document/folder picker using a synthetic QA location accessible to the emulator. Record the resulting filename/path if visible.
3. Verify the backup operation reports success.
4. Close/force-stop the app.
5. Clear only `pl.ryczalt.rental` app data.
6. Relaunch; verify the app is empty and onboarding is offered again.
7. Ustawienia → Dane i kopia zapasowa → **Przywróć z kopii**.
8. Select the just-created QA backup and confirm the destructive restore prompt.
9. Verify all important facts return:
   - apartment/address;
   - tenant name/phone/email;
   - owner rent/media/media responsibility/payment day;
   - advanced apartment fields;
   - both rent receipts;
   - tax payment;
   - reminder settings;
   - calculated current tax/rent status.
10. If the platform file picker cannot be driven reliably in the emulator environment, mark **G SKIPPED — picker automation unavailable** with evidence. Do not silently count this as pass.
11. Capture `18-backup-created`, `19-after-clear`, `20-restored`.

### H. Restart persistence and final cross-screen consistency

1. Force-stop the app and relaunch explicitly.
2. Revisit Pulpit, Przychód, Podatek, Ustawienia → Mieszkania.
3. Verify the restored/current dataset remains consistent:
   - QA-Parkowa exists;
   - tenant/contact and terms persist;
   - receipt total/status matches the final D fixture;
   - tax paid/outstanding state matches the final E fixture;
   - no duplicate reminders/tasks appear;
   - no removed bills/custom reminders reappear.
4. Exercise month/period previous/next buttons where enabled and verify they do not jump outside the valid range.
5. Capture `21-final-pulpit`, `22-final-income`, `23-final-tax`, `24-final-property`.

## Interaction coverage record

In `results.md`, include a checklist showing whether each user-facing action was exercised. At minimum:

- Fresh Pulpit: Rozpocznij · 3 kroki, Zobacz demo.
- Demo banner: Wyjdź z demo.
- Wizard: Dalej, Wstecz, Pomiń na razie, Zamknij if encountered, both tax radio choices, media switch, Zapisz mieszkanie.
- Pulpit: apartment quick-add, tax summary navigation, applicable period controls, any available bulk confirmation open/close.
- Przychód: add, edit/save, delete-cancel, delete-confirm.
- Podatek: info disclosure, transfer details, payment create, edit, delete-cancel, delete-confirm, history-review close/continue when applicable.
- Settings: each current section, disclosures, relevant toggles/radio controls, notification category switches, rent-delay choices, backup/create/restore when G is runnable.
- Diagnostic notification: Test za 5 min.
- App lifecycle: force-stop/relaunch.

If a control is conditional and cannot appear with the fixed current-date fixture, record **N/A + reason** rather than manufacturing state by changing the device clock.

## Pass criteria and reporting

A–F and H must pass. G must pass unless blocked specifically by system-picker automation; that exception must be explicit. The diagnostic notification in A must schedule and deliver once on the emulator, but this is only an emulator smoke check.

`results.md` must include:

- commit SHA and branch;
- APK path + SHA-256;
- emulator serial/model/API/size/density;
- date/timezone;
- A–H pass/fail/skip;
- interaction coverage checklist;
- notification scheduled time and observed delivery time;
- evidence filenames;
- any divergence from the fixed fixture.

Do not edit source code during the run unless the user separately asked to fix failures. Preserve failure evidence first.

This plan establishes Android API 35 emulator behavior only. It does **not** replace physical-device notification delivery/tap/reboot/revoke-regrant validation, store signing checks, or legal/tax verification beyond automated domain tests.

## Optional follow-ups

Only when specifically requested:

- physical-device notification matrix;
- gesture-navigation AVD;
- alternate small/large display profile;
- iOS Simulator regression;
- corrupt-storage injection/recovery;
- legacy-schema import;
- future-year provisional tax UI.
