import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { bootstrapHistoricalRentPayments, historicalBootstrapDefaultRange, historicalTaxPaymentsForImportedRent } from "./historicalRentBootstrap";
import { calculateSettlements } from "./ryczaltTax";
import { rentMonthAmounts } from "./tasks";

const doc = (): RentalDocument => ({ schemaVersion: 1, properties: [], incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [], administrationSuggestions: [], customReminders: [], taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [], settings: { taxYear: 2026, settlementMode: "monthly", jointSpouseThreshold: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true, custom: true }, rentReminderDelayDays: 1 } });
const property = { id: "p1", address: "Parkowa 1", ownerRent: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, rentalStartDate: "2026-03-12", paymentDay: 5, rentSchedule: [{ effectiveFrom: "2026-03", amount: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }] };

describe("historical rent bootstrap", () => {
  it("defaults to the rental start month through the last completed month", () => {
    expect(historicalBootstrapDefaultRange("2026-09-28", property.rentalStartDate)).toEqual({ startMonth: "2026-03", endMonth: "2026-08" });
    expect(historicalBootstrapDefaultRange("2026-01-02", property.rentalStartDate).endMonth).toBeNull();
  });

  it("adds separate monthly receipt facts, taxes the owner component, and is idempotent", () => {
    const initial = doc();
    initial.properties = [property];
    const first = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-01", endMonth: "2026-09", today: "2026-09-28" });
    expect(first.created).toHaveLength(6);
    expect(first.created[0]).toMatchObject({ rentalMonth: "2026-03", receivedAt: "2026-03-12", amount: "3000.00", taxableAmount: "2500.00", source: "INITIAL_IMPORT" });
    expect(first.created[0]).not.toHaveProperty("tenantNameSnapshot");
    expect(first.created.at(-1)?.rentalMonth).toBe("2026-08");
    expect(first.document.properties[0]?.rentalStartDate).toBe("2026-03-12");
    expect(rentMonthAmounts(first.document.properties[0]!, first.document.incomeEntries, "2026-03", new Date(2026, 8, 28))).toMatchObject({ expectedGrosz: 300_000, confirmedGrosz: 300_000, remainingGrosz: 0 });
    expect(first.skippedMonths).toEqual(["2026-01", "2026-02"]);
    const again = bootstrapHistoricalRentPayments({ document: first.document, property, startMonth: "2026-01", endMonth: "2026-09", today: "2026-09-28" });
    expect(again.created).toHaveLength(0);
    expect(again.document.incomeEntries).toHaveLength(6);
    const settlements = calculateSettlements({ entries: first.created, payments: [], taxYear: 2026, mode: "monthly", today: "2026-09-28" });
    expect(settlements.find(({ period }) => period === "2026-03")?.revenueGrosz).toBe(250_000);
    expect(settlements.find(({ period }) => period === "2026-02")?.revenueGrosz).toBe(0);
    expect(settlements.find(({ period }) => period === "2026-03")?.dueDate).toBe("2026-04-20");
  });

  it("does not assign the current tenant to imported historical receipts", () => {
    const occupiedProperty = { ...property, tenantName: "Current tenant" };
    const initial = doc();
    initial.properties = [occupiedProperty];
    const result = bootstrapHistoricalRentPayments({ document: initial, property: occupiedProperty, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(result.created[0]).not.toHaveProperty("tenantNameSnapshot");
  });

  it("uses the configured charges policy and keeps estimated imported receipts marked", () => {
    const includeCharges = { ...property, taxableTreatment: "RENT_AND_CHARGES" as const, rentSchedule: property.rentSchedule.map((rate) => ({ ...rate, taxableTreatment: "RENT_AND_CHARGES" as const })) };
    const initial = doc();
    initial.properties = [includeCharges];
    const result = bootstrapHistoricalRentPayments({ document: initial, property: includeCharges, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(result.created[0]).toMatchObject({ amount: "3000.00", taxableAmount: "3000.00", receivedAt: "2026-03-12", source: "INITIAL_IMPORT" });
  });

  it("assumes historical tax was paid by default but allows the user to leave it unpaid", () => {
    const initial = doc();
    initial.properties = [property];
    const result = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(historicalTaxPaymentsForImportedRent(result.document, result.created)).toEqual([{ id: "initial-tax-2026-03", period: "2026-03", paidAt: "2026-04-20", amount: "213.00", source: "INITIAL_IMPORT" }]);
    expect(historicalTaxPaymentsForImportedRent(result.document, result.created, false)).toEqual([]);
  });

  it("re-estimates an imported assumed payment when another apartment is imported for the same month", () => {
    const initial = doc();
    initial.properties = [property, { ...property, id: "second", address: "Druga 2" }];
    const first = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    const firstTax = historicalTaxPaymentsForImportedRent(first.document, first.created);
    const withFirstTax = { ...first.document, taxPayments: firstTax };
    const second = bootstrapHistoricalRentPayments({ document: withFirstTax, property: { ...property, id: "second", address: "Druga 2" }, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(historicalTaxPaymentsForImportedRent(second.document, second.created)).toEqual([{ ...firstTax[0], amount: "425.00" }]);
  });

  it("skips pre-existing months and the current or future months", () => {
    const initial = doc();
    initial.properties = [property];
    initial.incomeEntries = [{ id: "existing", propertyId: property.id, receivedAt: "2026-04-10", rentalMonth: "2026-04", amount: "3000.00", taxableAmount: "2500.00" }];
    const result = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-12", today: "2026-09-28" });
    expect(result.created.map(({ rentalMonth }) => rentalMonth)).toEqual(["2026-03", "2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(result.skippedMonths).toContain("2026-04");
    expect(result.created.some(({ rentalMonth }) => rentalMonth! >= "2026-09")).toBe(false);
  });

  it("backdates the initial rent rate to the selected start when the rental start was not entered", () => {
    const withoutStart = { ...property, rentalStartDate: undefined, rentSchedule: [{ effectiveFrom: "2026-09", amount: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }] };
    const initial = doc();
    initial.properties = [withoutStart];
    const result = bootstrapHistoricalRentPayments({ document: initial, property: withoutStart, startMonth: "2026-01", endMonth: "2026-08", today: "2026-09-28" });
    expect(result.document.properties[0]?.rentSchedule).toEqual([{ effectiveFrom: "2026-01", amount: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }, { effectiveFrom: "2026-09", amount: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }]);
    expect(result.document.properties[0]?.rentalStartDate).toBe("2026-01-01");
    expect(rentMonthAmounts(result.document.properties[0]!, result.document.incomeEntries, "2026-08", new Date(2026, 8, 28))).toMatchObject({ expectedGrosz: 300_000, confirmedGrosz: 300_000, remainingGrosz: 0 });
  });
});
