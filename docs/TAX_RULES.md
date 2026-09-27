# Private rental tax rules

The calculation engine supports tax years 2025 and 2026 only. Do not extend this table to another year without checking the rules in force for that year.

| Tax year | Lower rate | Annual threshold | Rate above threshold | Source checked |
| --- | ---: | ---: | ---: | --- |
| 2025 | 8.5% | PLN 100,000 | 12.5% | Ministry of Finance private-rental guidance and PIT-28 2025 guide |
| 2026 | 8.5% | PLN 100,000 | 12.5% | Ministry of Finance private-rental guidance, updated 2026-08-20 |

For marital joint-property rental where the required election to tax all rental receipts by one spouse applies, the higher-rate threshold is PLN 200,000. This must not be used merely because the taxpayer is married.

Taxable receipts are grouped by the actual receipt date, summed across apartments, and the annual threshold is applied cumulatively. Monthly or quarterly tax is calculated on that period's revenue at the rates applying to the cumulative threshold position, then rounded to whole PLN (50 grosz rounds upward). Calculations use integer grosz. Confirmed tax payments do not change the tax obligation or income records. Payments are applied oldest-outstanding-period first; any amount remaining after all accrued obligations is a tax credit carried forward to reduce later periods. Each period retains its own outstanding liability bucket, so prior unpaid amounts remain visible once and are not counted again as new later-period liability. The period in which an excess payment was confirmed continues to show that overpayment; the resulting credit is applied automatically to subsequent obligations. Editing or removing a payment recalculates the allocation and later balances.

The payment deadline is the 20th day of the next month, or the month after quarter end, with December/fourth-quarter payments due in January. A deadline falling on a Saturday, Sunday, or Polish public holiday moves to the next working day. Quarterly settlement is shown only after the user confirms eligibility; the app does not independently establish eligibility from tax records. One statutory eligibility route uses a prior-year revenue ceiling of EUR 200,000. The PLN equivalent is year-specific (PLN 856,920 for 2025; PLN 851,720 for 2026), and the taxpayer must verify all conditions that apply to them.

Implementation alignment: `RYCZALT_RULES` supports only 2025 and 2026, the settings/document validator accepts those supported years, and the settlement screen reports other years as unavailable. The `jointSpouseThreshold` setting is a user-confirmed condition, not an eligibility determination. The engine does not calculate personal deductions or prepare PIT-28. Therefore the result is a recordkeeping estimate from the taxable amounts the user enters, not a complete tax return calculation.

Calculation regression tests live in `src/domain/ryczaltTax.test.ts`. They protect the annual threshold split, actual-receipt-date grouping across properties, monthly and quarterly periods, exact/partial/overpaid balances, oldest-period payment allocation and credit carry-forward, correction/removal recalculation, whole-PLN rounding, and deadline adjustment. Tax-payment mutation tests live in `src/domain/taxPayment.test.ts` and assert income records remain unchanged. Keep test dates explicit with `today` so status assertions do not drift as calendar time advances. When rules or rounding behavior change, update both the examples here and the matching test cases.

## Official sources

- [Ministry of Finance: private rental income](https://www.podatki.gov.pl/podatki-osobiste/pit/informacje-podstawowe/co-jest-opodatkowane/dochody-z-najmu) (rates, joint-property threshold, receipt-date basis, periods, and deadlines; updated 2026-08-20).
- [Ministry of Finance: PIT-28 for 2025](https://www.podatki.gov.pl/twoj-e-pit/pit-28-za-2025-rok) (year-specific private-rental treatment and whole-zloty rounding).
- [Ministry of Finance: PIT limits](https://www.podatki.gov.pl/podatki-osobiste/pit/stawki-i-limity) (annual PLN equivalents for quarterly settlement eligibility).
- [Tax Ordinance, Article 63](https://isap.sejm.gov.pl/isap.nsf/download.xsp/WDU20051431199/T/D20051199L.pdf) (rounding rule; amendments should be checked before relying on the consolidated wording).
