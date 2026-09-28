# Final POC Correctness Review

## Executive result

**NOT READY** — code and automated validation are complete, but the required Android smoke test did not complete. The attempted apartment entry left the rent field at its placeholder value; save correctly rejected the apartment. No application defect was established by this interaction. Per the emulator smoke procedure, testing stopped at the first failed scenario and the emulator state/evidence were preserved. Rerun the smoke with rent entered explicitly before starting the clean acceptance run.

## Findings

### Taxable treatment of media and additional charges

Status: **FIXED**

`Property.taxableTreatment` requires an explicit `OWNER_RENT` or `RENT_AND_CHARGES` choice. `defaultTaxableAmountGrosz()` is the single domain policy used by normal, bulk, and historical confirmations. `mediaPaidByTenant` does not select the tax treatment. Existing receipt taxable amounts remain stored facts through migration. See [TAX_RULES.md](TAX_RULES.md) and tests in `apartmentPayments`, `bulkRentConfirmation`, `historicalRentBootstrap`, and `localRentalStore`.

### Invented lease-end dates

Status: **FIXED**

New apartment defaults leave the lease end empty. Lease-end tasks require an entered date. Covered by apartment setup and task tests.

### Reminder migration and legacy reminder lead time

Status: **FIXED**

Migration preserves rent reminders as enabled only when every migrated apartment explicitly enabled them. Disabled, mixed, missing, and all-enabled fixtures are covered. Legacy custom lease-end reminder days are preserved in notes when the current global reminder model cannot represent them; they are not described as a 30-day preference. Policy is recorded in [NOTIFICATIONS.md](NOTIFICATIONS.md).

### Legacy apartment data

Status: **FIXED**

Legacy administrator phone/email and a distinct apartment name are appended to notes when no current dedicated field can hold them. Existing notes are retained. Migration tests cover combinations and idempotence.

### Historical import dates and provenance

Status: **FIXED**

Estimated receipt dates are clamped to the rental start date and retain `INITIAL_IMPORT` provenance. Imported dates are visibly marked estimated. The existing tax period remains derived from `receivedAt`; annual income and threshold progression use the same confirmed/imported taxable amounts. Boundary, provenance, period, and edit-preservation tests cover this behavior.

### Tax year navigation and unsupported rules

Status: **FIXED**

Tax navigation derives available display years from the calendar and tracking period. 2025 and 2026 use supported rules; 2027 is navigable when it is the current year but calculations fail safely and the UI explains that rules are unavailable. Future years are not selectable. Tests cover the 2027 boundary and rule unavailability.

### December/Q4 deadline and PPE payment details

Status: **VERIFIED**

December/Q4 payment resolves to 20 January of the following year. Payment guidance identifies PPE and shows the existing human-readable settlement period; it does not invent a bank-specific period code. Tests cover December and the displayed period. Sources are listed under Tax sources.

### Primary brand color

Status: **FIXED**

The primary theme token is red again; semantic success remains green and navigation/text retain their existing secondary colors.

### Small cleanup and backup behavior

Status: **FIXED / DOCUMENTED**

Duplicate Unreleased changelog headings were consolidated, redundant `rentalStartDate` assignment removed, and demo queued-mutation discard behavior documented in code. Android backup remains enabled by the generated manifest; product copy says local data may be removed, and [ARCHITECTURE.md](ARCHITECTURE.md) documents that Android backup can restore it and AsyncStorage is not encrypted.

## Tax-base behavior

- Owner rent is taxable under `OWNER_RENT`.
- Owner rent plus configured additional charges is taxable under `RENT_AND_CHARGES`.
- The landlord explicitly chooses based on the rental agreement; the app does not infer the choice from who pays media.
- Bulk confirmation and historical import use the same domain helper as normal confirmation.
- Existing confirmed taxable amounts are not rewritten by migration.

## Migration behavior

- Rent reminders stay on only when all legacy apartments explicitly had them on; ambiguous states migrate conservatively to off.
- Lease-end dates are not synthesized.
- Administrator contact details and distinct legacy apartment labels are retained in notes, alongside existing notes.
- Custom legacy lease-end reminder days are retained in notes because the simplified global model cannot represent them.
- Migration coverage includes current data, legacy reminder variants, contacts, name/address, custom lead time, imported payments, notes, and idempotence.

## Historical import

Imported estimated dates cannot precede `rentalStartDate`, and entries retain `INITIAL_IMPORT`. The date determines the existing monthly tax period and therefore deadline; it contributes to the same annual taxable income and threshold progression. The UI labels imported dates as estimates.

## Tax-year handling

- 2025 and 2026 have supported tax rules.
- 2027 can be displayed/navigated when current, without applying 2026 rules.
- Unsupported tax-rule years fail safely; future years are unavailable in navigation.

## Tax sources

- [Ministry of Finance: private rental](https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/dochody-z-najmu) — receipt basis, rates/threshold, deadlines, and agreement-dependent treatment of tenant-responsible charges; checked 2026-09-28.
- [Ministry of Finance: micro-account and PPE](https://www.podatki.gov.pl/pytania-i-odpowiedzi/mikrorachunek/czy-zryczaltowany-podatek-dochodowy-z-najmu-nieruchomosci-wplacam-na-mikrorachunek-podatkowy) — periodic rental ryczałt payment channel and PPE; checked 2026-09-28.
- [ISAP: Tax Ordinance, 2026 consolidated text](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20260000622) — statutory payment deadline provisions; checked 2026-09-28.

Source references and configuration-dependent assumptions are documented in [TAX_RULES.md](TAX_RULES.md).

## Validation

- `npm ci` — passed; 629 packages audited, 11 moderate advisories reported by npm.
- `npm run ci` — passed: TypeScript, ESLint, and 237 tests across 30 files.
- `npx expo-doctor` — passed, 21/21 checks.
- Local release APK built and signature verified. SHA-256: `2c9f97452b6fdc29a8e05001013d56f522f6b048ca075ddef990a28242d3c742`.

## Android smoke test

Emulator: `sdk_gphone64_arm64`, API 35, 320×640, 160 dpi, `ro.kernel.qemu=1`. Fresh release APK installed and launched successfully; initial setup and bottom navigation were visible within safe areas.

The apartment-save scenario stopped because the owner-rent field had not been entered; its visible `2500` was a placeholder, and the computed total correctly remained `0,00 zł`. Save rejected the apartment with “Brak czynszu właściciela.” This does not verify the remaining smoke scenarios. Evidence, including screenshots, UI hierarchies, and logcat, is in `artifacts/emulator-e2e/20260928-1940-6e1aa9f/` (`01-launch.png`, `03-settings.png`, `05-editor.png`, `06-save-failure.png`, matching XML, and `logcat-save-failure.txt`). Emulator data was not cleared after the failed scenario.

## Parked items

- Android backup may restore local data after reinstall, and local storage is not encrypted. The current POC copy and architecture documentation describe this behavior; changing backup policy is outside this correctness pass.
- Physical-device behavior, notification delivery, and hosted EAS build remain unverified. They are not represented as tested; the requested next step remains a clean Android acceptance run after the smoke flow is completed.
