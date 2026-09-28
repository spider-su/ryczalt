# Private rental tax rules

**Scope:** Polish private residential rental recorded as ryczałt. This is a receipt ledger and estimate, not a tax return or legal classification tool. Sources below were checked on **2026-09-28**.

## Supported tax rules

| Tax year | Rate up to annual threshold | Threshold | Rate above threshold | Source checked |
| --- | ---: | ---: | ---: | --- |
| 2025 | 8.5% | PLN 100,000 | 12.5% | Ministry of Finance private-rental guidance and PIT-28 2025 guide |
| 2026 | 8.5% | PLN 100,000 | 12.5% | Ministry of Finance private-rental guidance, updated 2026-08-20 |

For joint marital property where the required election to tax all rental income by one spouse applies, the higher-rate threshold is PLN 200,000. Marriage alone does not satisfy this condition. The setting is user-confirmed; the app does not determine ownership, eligibility, or whether the election was filed.

The tax engine supports only 2025 and 2026. Calendar navigation can reach later years, but no calculation or tax task is generated without an explicitly supported rule set. Never carry the previous year's rates forward automatically. 2025 and 2026 rate/threshold rules are supported by Ministry of Finance guidance; 2027 remains unavailable pending verification.

## What controls taxable rent

The Ministry of Finance says private-rental income arises when money is received or made available. It also states that fees for utilities and similar charges are not the landlord's rental income where the rental agreement makes the tenant responsible for those charges. How a particular agreement allocates responsibility is a factual and contractual question.

Each apartment therefore stores an explicit `taxableTreatment`, independent of `mediaPaidByTenant`:

- `OWNER_RENT`: cap taxable receipts for the rental month at the scheduled owner's rent, carrying that cap across partial receipts.
- `RENT_AND_CHARGES`: treat the full confirmed receipt as taxable.

The landlord must choose based on the actual agreement and payment arrangement. The labels are calculation choices, not statements that one option is universally correct. An apartment without a confirmed choice cannot create new receipt tax amounts until the landlord selects one. Confirmed `IncomeEntry.taxableAmount` values are saved facts and are not recalculated when rent terms change.

This single rule is applied by `defaultTaxableAmountGrosz` to individual confirmations, bulk confirmations and historical imports. `mediaPaidByTenant` controls expected tenant rent only; it does not decide taxable treatment. Users may edit an existing confirmed receipt's taxable amount as a correction, and that stored amount remains the tax engine input.

## Receipt periods, rounding and thresholds

The tax base uses each receipt's `receivedAt` date, including receipts assigned to a rent month for reconciliation. Annual threshold progression uses cumulative taxable receipts grouped by the actual/recorded receipt month. This is aligned with Ministry guidance that income arises when received or made available. The app does not tax unpaid expected rent.

Historical onboarding creates `INITIAL_IMPORT` entries using the configured payment day as an estimated received date. The displayed date is marked **data szacunkowa**. If it falls before the configured rental start date, it is clamped to that start date. Because the estimate remains the stored `receivedAt`, it affects the calculated calendar tax month, annual threshold progression, and corresponding deadline. Users should correct imported dates when they know the actual receipt dates; the import provenance remains `INITIAL_IMPORT` after edits.

For a monthly or quarterly period, the taxable base is rounded to whole PLN before rate calculation, with 50 grosz rounding up; the calculated tax is then rounded to whole PLN. Cumulative rate-threshold use is based on the sum of those rounded period bases. Calculations use integer grosz. The whole-zloty rounding rule is in Article 63 of the Tax Ordinance. Individual deductions are not modelled; this limits the result to a recordkeeping estimate from the configured taxable amounts.

## Periods, deadlines and payment details

The Ministry of Finance specifies payment by the 20th of the following month for monthly payments and by the 20th of the month after quarter end for quarterly payments. December and Q4 payments are due by 20 January of the following year. Under Article 12 §5 of the Tax Ordinance, a deadline on Saturday or a statutory holiday moves to the next day that is not a Saturday or statutory holiday. The annual PIT-28 filing/payment deadline is separate and is not implemented as a filing engine.

The Ministry specifies **PPE** as the payment form symbol for interim monthly/quarterly rental ryczałt and PIT-28 for annual return tax. The app shows PPE, the selected human-readable settlement period, the due date and configured micro-account. It does not invent a bank-specific period code or generate a payment QR. Users must verify payment details with their bank and tax account. PPE guidance is not annual filing support.

The app supports monthly settlement only. Quarterly settlement is not offered or selectable.

Tax payments do not change income or tax obligations. Recorded payments allocate oldest outstanding period first, with excess carried as credit into later periods. Opening taxable revenue and paid tax are aggregate prior-to-tracking context: any difference is displayed separately and is not assigned a fabricated month or deadline.

## Official sources

All were accessed/checked on **2026-09-28**.

| Source title | URL | Rule used |
| --- | --- | --- |
| Ministry of Finance, “Rozliczenie przychodów z najmu prywatnego” (updated 2026-08-20) | https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/dochody-z-najmu | Receipt timing, tenant-borne charges, 8.5%/12.5% rates, PLN 100,000/200,000 thresholds, monthly/quarterly deadlines, December/Q4 January deadline and PPE symbol. |
| Ministry of Finance, “Czy zryczałtowany podatek dochodowy z najmu nieruchomości wpłacam na mikrorachunek podatkowy?” | https://www.podatki.gov.pl/pytania-i-odpowiedzi/mikrorachunek/czy-zryczaltowany-podatek-dochodowy-z-najmu-nieruchomosci-wplacam-na-mikrorachunek-podatkowy | Micro-account and PPE for periodic payment; PIT-28 for annual return payment. |
| Ministry of Finance, “PIT-28 za 2025 rok” | https://www.podatki.gov.pl/twoj-e-pit/pit-28-za-2025-rok | Year-specific guide and whole-zloty rounding cross-check. |
| Ministry of Finance, “Stawki i limity PIT” | https://www.podatki.gov.pl/podatki-osobiste/pit/stawki-i-limity | Quarterly eligibility PLN equivalents. |
| Tax Ordinance, 2026 consolidated text, Article 12 §5 and Article 63 | https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20260000622 | Saturday/statutory-holiday deadline shift and whole-PLN rounding. |

## Implementation checks

Regression coverage is in `src/domain/ryczaltTax.test.ts`, `src/domain/taxPayment.test.ts`, `src/domain/apartmentPayments.test.ts`, `src/domain/bulkRentConfirmation.test.ts`, and `src/domain/historicalRentBootstrap.test.ts`. These cover supported-rule failure, annual rate threshold, receipt-date grouping, rounding, deadline shift including December/Q4, tax-payment allocation, explicit tax-base handling and import estimates. Verify this source table and add tests before enabling a further tax year.
