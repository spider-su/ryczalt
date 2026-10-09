# Android emulator regression results

- Date: 2026-10-06 (emulator local clock; unchanged)
- Commit: `e563a35d4f010c23a3ee840065a66ab42336207b` (`develop`)
- APK: `artifacts/app/ryczalt.apk`
- APK SHA-256: `124ab4b56f0f42262eb02e3ab5af3a008043c0701a805f24e84fe3ee955187f7`
- Emulator: `emulator-5554`, `sdk_gphone64_arm64`, Android API 35; `ro.kernel.qemu=1`; 320x640 / 160 dpi
- App: `pl.ryczalt.rental`

## Cases

- **A — PASS (initial-state portion):** Fresh launch reached the empty-state dashboard. Status bar and bottom navigation are unobstructed; all four labeled tabs are visible above system navigation. Visited and captured Pulpit, Przychód, Podatek, and Ustawienia. Empty dashboard has no dead “Pokaż” action or future-rent flood. Evidence: `01-launch.*`, `02-income-empty.*`, `03-tax-empty.*`, `04-settings.*`.
- **B — PASS:** Added `QA-Parkowa`, expected rent `3 000 zł/month`, payment day 10. Apartment appears in settings; dashboard and income show October 2026 unpaid with `3 000 zł` expected / to confirm. Form had no prepopulated end date to clear. Initial-payment onboarding was skipped. Evidence: `07-apartment-saved.*`, `08-dashboard-unpaid.*`, `09-income-unpaid.*`.
- **C — FAIL at step 1 (blocked):** Dashboard shows `3 000 zł do potwierdzenia` and the income view lists QA-Parkowa as `Do potwierdzenia`, but opening the dashboard confirmation action shows no apartment/receipt row, `0,00 zł`, and `0 wpłat · 0,00 zł`; the confirm button says `Potwierdź 0 wpłat`. Therefore no exact receipt can be entered, and partial/multiple reconciliation steps were not attempted. Evidence: `10-confirm-receipt-form.png` and `.xml`.
- **D — NOT RUN:** Dependent on successfully confirming income in C.
- **E — PARTIAL, then stopped:** Settings landing screen inspected. It shows Mieszkania, Podatek i rozliczenia, Dane do przelewu, Powiadomienia, and Dane lokalne. Tax/spouse-threshold, native notification switches, and reminder flow not inspected.
- **F — NOT RUN:** Dependent persistence of two receipts and paid tax cannot be verified after C failed.

## Failure details

Reproduction: fresh-install/clear app data on the verified AVD; add QA-Parkowa with 3 000 zł rent and due day 10; from Pulpit tap the `3 000 zł do potwierdzenia` task. Expected a receipt row for QA-Parkowa eligible for confirmation. Actual confirmation sheet is empty and reports zero receipts, while the dashboard and Przychód independently show the unpaid 3 000 zł expectation. This is a reproducible UI/state inconsistency requiring investigation. No app code changes, reset, or destructive recovery were performed after capturing it.

This run covers Android API 35 emulator behavior only; it is not physical-device, notification-delivery, Play-signing, production-readiness, or tax/legal correctness evidence.

## User-reported follow-up validation (2026-10-06)

The user reports that a subsequent Android check passed: they created and evaluated apartments with correct numbers, received notifications, marked apartment rent and tax as paid, and checked the backup flow. This is recorded as user-reported follow-up and is separate from the captured run above, which stopped when its pre-due-date bulk confirmation sheet was empty. The follow-up APK hash, commit, emulator details, and screenshots were not provided here, so this note does not independently attribute that validation to the exact artifact/environment listed above.
