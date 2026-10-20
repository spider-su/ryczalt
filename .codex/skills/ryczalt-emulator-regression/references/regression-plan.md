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

### A. Fresh launch, current navigation, demo isolation and notification smoke test

1. Launch from empty storage and capture `01-fresh-pulpit`.
2. Verify:
   - Pulpit renders below the status bar;
   - current header navigation exposes Pulpit, Podatek, Mieszkania and Ustawienia without overlap with system bars;
   - no blank screen/crash/clipped title;
   - empty Pulpit offers **Rozpocznij · 3 kroki** and **Zobacz demo**.
3. Visit Podatek, Mieszkania and Ustawienia once before creating data and capture each. Confirm `Historia wpłat` is reached from Pulpit, not treated as primary navigation.
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

Failure criteria: demo changes persist into real data, the test is unavailable in demo, multiple diagnostic notifications arrive from one tap, scheduling requires changing rental facts, or delivery is more than two minutes after its scheduled due time. Record actual schedule/delivery timestamps even when within tolerance.

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
9. Verify the apartment is saved. For a start date before the current month, verify every rental period from the start month through the previous month is preconfirmed for rent, Opłaty and tax. Verify the current month starts pending for all three and no current-month payment was inferred from apartment creation.
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
   - verify save is blocked and visible feedback appears;
   - restore the valid value.
6. Save and reopen the apartment; verify all values persist.
7. If archive/pause lifecycle controls are present, inspect them but do not archive the sole QA apartment before completing income/tax cases.
8. Capture `08-apartment-advanced`.

### D. Current-month confirmation: rent, Opłaty and second-apartment effects

Use the current rental month. Do not move the emulator date.

1. Use the current rental month. Never move emulator time.
2. Before confirming rent, open Podatek and verify payment confirmation is unavailable while any apartment rent remains pending.
3. From Pulpit tap the `QA-Parkowa` apartment rent action and confirm the full current-month amount. For this fixture the receipt total is 3,500 zł (3,000 rent plus 500 tenant-paid media); the taxable amount remains 3,000 zł under `OWNER_RENT`. Receipt date is today and is not editable; period is the current month.
4. Verify the apartment is confirmed and no shortfall remains. Confirm historical Income remains grouped by month and does not need to list current-month activity.
5. Open Opłaty. Verify known charges total 500 zł from the apartment's tenant-paid terms; use the confirmation action. There must be no add-extra-charge form. Verify the charge changes from pending to confirmed without a duplicate.
6. Verify tax confirmation becomes available once all apartments' rents are confirmed. Record separately whether Opłaty is still pending; it is not a substitute for rent confirmation.
7. Add `QA-Lipowa` with a synthetic tenant, 2,000 zł owner rent, no Opłaty, and owner-rent tax basis. In **Więcej ustawień**, explicitly set **Najem rozpoczął się** to the first day of the current month (for example, `01 paź 2026`); do not leave it blank and do not confuse it with **Zastosuj zmiany od miesiąca**. Before saving, verify the start date is visible in the editor. Reopen after saving and verify it persisted. QA-Parkowa's receipt and seeded history must remain unchanged; QA-Lipowa's current month starts pending and has no pre-start history; dashboard expected/confirmed and taxable totals include its saved terms. Confirm QA-Lipowa rent; verify aggregate status says confirmed only when every apartment is confirmed.
8. If a bulk confirmation action is offered, inspect it and close without creating a duplicate; otherwise mark N/A with reason.
9. Capture pending/gated, rent confirmed, Opłaty confirmation, second-apartment impact and final aggregate states.

### E. Tax calculation, rent gate and full payment confirmation

1. First verify the tax payment action is gated while any apartment's current-month rent is pending. Complete D, then open Podatek.
2. Verify taxable revenue is 3,000 zł under `OWNER_RENT` (media excluded from the taxable base).
3. Verify the obligation is 255 zł (8.5% of 3000, rounded according to the domain rules).
4. Expand **Rok <year>**, verify annual taxable income / threshold / remaining-threshold details, then collapse it.
5. Expand/collapse **Jak liczymy podatek?** and annual threshold details.
6. While tax is outstanding, open **Dane do przelewu**; test copy only for populated synthetic details, then close.
7. Tap **Potwierdź wykonaną wpłatę** and verify the full remaining amount is prefilled. Confirm the tax payment.
8. Verify status **Opłacone**, zero remaining, and updated history count/date/amount. Transfer details must no longer be promoted as an outstanding action.
9. Exercise edit/delete/cancel only if exposed by the current UI. Do not invent partial tax or overpayment paths if only full confirmation is supported; record N/A with evidence.
10. Capture `12-tax-before-payment`, `13-tax-payment-form`, `14-tax-paid`.

### F. Settings coverage

Exercise every current Settings section at least once. The expected POC sections are the current equivalents of:

- Mieszkania;
- Podatek i rozliczenia;
- Dane do przelewu;
- Powiadomienia;
- Dane lokalne / backup.

Removed bills/custom-reminder sections must **not** reappear.

1. Tax settings are opened from the **Podatek** tab via **Ustawienia podatku**, not from the general Settings list:
   - open spouse-threshold explanation;
   - leave the 200k option disabled for the fixture;
   - inspect tax year/settlement controls;
   - enter opening balances only if doing so will not invalidate the current fixture; otherwise verify controls and document why they are not modified;
   - return to Podatek and verify the selected period is preserved.
2. Transfer settings: verify the micro-account guidance and empty state. If checking validation, use synthetic data, verify rejection, then remove it.
3. Notifications:
   - verify permission state;
   - exercise rent-delay choices and return to the intended value;
   - toggle each currently shown rent/Opłaty/agreement/tax category off and back on;
   - verify upcoming reminder list remains coherent;
   - if the build is dev/demo-enabled at this point, the **Test za 5 min** control may be smoke-tested again, but do not require a second five-minute wait.
4. Data: open backup/recovery information and verify local-storage/privacy wording. Do not claim a portable backup is encrypted unless the UI or implementation establishes that.
   - do not reset data before the backup case.
5. Return to Pulpit and verify no removed personal-reminder/bill UI is present.
6. Capture `15-settings-tax`, `16-settings-notifications`, `17-settings-data`.

### G. Backup → clear app data → restore round trip

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
   - bootstrapped historical confirmations and current-month rent/Opłaty confirmations;
   - current tax calculation and payment;
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
   - each apartment's rent state and aggregate total match the final D fixture;
   - Opłaty state and total match the final D fixture;
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
- Pulpit: rent and Opłaty confirmation, tax navigation, applicable period controls, aggregate status and second-apartment recalculation.
- Przychód: verify current month is handled by current-period flow and historical receipts remain available. Edit/delete/partial actions are only required if exposed by current UI.
- Podatek: rent gate, taxable basis, calculation disclosure, transfer details, full payment and history. Mark removed partial/overpayment/edit/delete paths N/A unless present.
- Settings: Mieszkania, Dane do przelewu, Powiadomienia, Dane lokalne; tax settings from Podatek; disclosures, notification category switches and delays, local-data/privacy wording, backup/create/restore.
- Diagnostic notification: Test za 5 min.
- App lifecycle: force-stop/relaunch.

If a control is conditional and cannot appear with the fixed current-date fixture, record **N/A + reason** rather than manufacturing state by changing the device clock.

## Pass criteria and reporting

A–F and H must pass. G must pass unless blocked specifically by system-picker automation; that exception must be explicit. D must include Opłaty confirmation and adding a second apartment after the first is confirmed. The diagnostic notification must deliver once near the five-minute target; record actual delay without changing emulator time. This remains an emulator smoke check only.

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
