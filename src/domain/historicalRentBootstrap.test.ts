import { describe, expect, it } from "vitest";
import type { RentalDocument } from "../model/rental";
import { bootstrapHistoricalRentPayments, historicalBootstrapDefaultRange, historicalTaxPaymentsForImportedRent } from "./historicalRentBootstrap";
import { calculateSettlements } from "./ryczaltTax";
import { decimalFromGrosz } from "./apartmentPayments";
import { rentMonthAmounts } from "./tasks";

const doc = (): RentalDocument => ({ schemaVersion: 1, properties: [], incomeEntries: [], taxPayments: [], recurringBills: [], billPayments: [], administrationSuggestions: [], taskStates: [], apartmentPeriods: [], taxSettlementSnapshots: [], settings: { taxYear: 2026, jointSpouseThreshold: false, reminderCategories: { rent: true, agreements: true, tax: true, bills: true }, rentReminderDelayDays: 1 } });
const property = { id: "p1", address: "Parkowa 1", ownerRent: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, rentalStartDate: "2026-03-12", paymentDay: 5, rentSchedule: [{ effectiveFrom: "2026-03", amount: "2500.00", mediaAmount: "500.00", mediaPaidByTenant: true, taxableTreatment: "OWNER_RENT" as const, paymentDay: 5 }] };

describe("historical rent bootstrap", () => {
  it("initializes every completed month but leaves October rent and tax pending", () => {
    const octoberProperty = { ...property, rentalStartDate: "2026-01-01", rentSchedule: [{ ...property.rentSchedule[0]!, effectiveFrom: "2026-01" }] };
    const initial = { ...doc(), properties: [octoberProperty] };
    const range = historicalBootstrapDefaultRange("2026-10-19", octoberProperty.rentalStartDate);
    expect(range).toEqual({ startMonth: "2026-01", endMonth: "2026-09" });
    const result = bootstrapHistoricalRentPayments({ document: initial, property: octoberProperty, startMonth: range.startMonth, endMonth: range.endMonth!, today: "2026-10-19" });
    expect(result.created.map((entry) => entry.rentalMonth)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(rentMonthAmounts(octoberProperty, result.document.incomeEntries, "2026-09", new Date(2026, 9, 19)).remainingGrosz).toBe(0);
    expect(rentMonthAmounts(octoberProperty, result.document.incomeEntries, "2026-10", new Date(2026, 9, 19))).toMatchObject({ confirmedGrosz: 0, remainingGrosz: 300000 });
    expect(result.document.taxPayments.some((payment) => payment.period === "2026-10")).toBe(false);
    expect(bootstrapHistoricalRentPayments({ document: result.document, property: octoberProperty, startMonth: range.startMonth, endMonth: range.endMonth!, today: "2026-10-19" }).created).toHaveLength(0);
  });

  it("preconfirms historical apartment media but never current-month media", () => {
    const initial = doc();
    initial.properties = [property];
    const result = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-09", today: "2026-10-19" });
    expect(result.document.billPayments.filter((payment) => payment.billId === "apartment-media")
      .map((payment) => [payment.period, payment.amount])).toEqual([
        ["2026-03", "500.00"], ["2026-04", "500.00"], ["2026-05", "500.00"],
        ["2026-06", "500.00"], ["2026-07", "500.00"], ["2026-08", "500.00"], ["2026-09", "500.00"],
      ]);
    const repeated = bootstrapHistoricalRentPayments({ document: result.document, property, startMonth: "2026-03", endMonth: "2026-09", today: "2026-10-19" });
    expect(repeated.document.billPayments).toHaveLength(7);
    expect(repeated.document.billPayments.some((payment) => payment.period === "2026-10")).toBe(false);
  });

  it("recalculates generated media for a second apartment and preserves manual confirmation", () => {
    const second = { ...property, id: "second", address: "Second" };
    const initial = { ...doc(), properties: [property, second] };
    const first = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-03", today: "2026-10-19" });
    const combined = bootstrapHistoricalRentPayments({ document: first.document, property: second, startMonth: "2026-03", endMonth: "2026-03", today: "2026-10-19" });
    expect(combined.document.billPayments).toMatchObject([{ id: "initial-media-2026-03", amount: "1000.00" }]);
    const manual = { id: "manual", billId: "apartment-media", period: "2026-04", paidAt: "2026-04-12", amount: "500.00" };
    const next = bootstrapHistoricalRentPayments({ document: { ...combined.document, billPayments: [...combined.document.billPayments, manual] }, property: second, startMonth: "2026-04", endMonth: "2026-04", today: "2026-10-19" });
    expect(next.document.billPayments.find((item) => item.id === "manual")).toEqual(manual);
    expect(next.document.billPayments.filter((item) => item.period === "2026-04")).toHaveLength(1);
  });

  it("defaults to the rental start month through the current month", () => {
    expect(historicalBootstrapDefaultRange("2026-09-28", property.rentalStartDate)).toEqual({ startMonth: "2026-03", endMonth: "2026-09" });
    expect(historicalBootstrapDefaultRange("2026-01-02", property.rentalStartDate).endMonth).toBe("2026-01");
    expect(historicalBootstrapDefaultRange("2026-09-28", "2025-01-01").startMonth).toBe("2025-01");
  });

  it("adds separate monthly receipt facts, taxes the owner component, and is idempotent", () => {
    const initial = doc();
    initial.properties = [property];
    const first = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-01", endMonth: "2026-09", today: "2026-09-28" });
    expect(first.created).toHaveLength(7);
    expect(first.created[0]).toMatchObject({ rentalMonth: "2026-03", receivedAt: "2026-03-12", amount: "3000.00", taxableAmount: "2500.00", source: "INITIAL_IMPORT" });
    expect(first.created[0]).not.toHaveProperty("tenantNameSnapshot");
    expect(first.created.at(-1)).toMatchObject({ rentalMonth: "2026-09", receivedAt: "2026-09-28" });
    expect(first.document.billPayments).toHaveLength(7);
    expect(first.document.billPayments[0]).toMatchObject({ billId: "apartment-media", period: "2026-03", paidAt: "2026-03-12", amount: "500.00" });
    expect(first.document.billPayments.at(-1)).toMatchObject({ billId: "apartment-media", period: "2026-09", paidAt: "2026-09-28", amount: "500.00" });
    expect(first.document.properties[0]?.rentalStartDate).toBe("2026-03-12");
    expect(rentMonthAmounts(first.document.properties[0]!, first.document.incomeEntries, "2026-03", new Date(2026, 8, 28))).toMatchObject({ expectedGrosz: 300_000, confirmedGrosz: 300_000, remainingGrosz: 0 });
    expect(first.skippedMonths).toEqual(["2026-01", "2026-02"]);
    const again = bootstrapHistoricalRentPayments({ document: first.document, property, startMonth: "2026-01", endMonth: "2026-09", today: "2026-09-28" });
    expect(again.created).toHaveLength(0);
    expect(again.document.incomeEntries).toHaveLength(7);
    const settlements = calculateSettlements({ entries: first.created, payments: [], taxYear: 2026, today: "2026-09-28" });
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

  it("records the initial historical tax obligation as paid", () => {
    const initial = doc();
    initial.properties = [property];
    const result = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(historicalTaxPaymentsForImportedRent(result.document, result.created)).toEqual([{ id: "initial-tax-2026-03", period: "2026-03", paidAt: "2026-04-20", amount: "213.00", source: "INITIAL_IMPORT" }]);
    expect(result.document.taxPayments).toEqual([{ id: "initial-tax-2026-03", period: "2026-03", paidAt: "2026-04-20", amount: "213.00", source: "INITIAL_IMPORT" }]);
    expect(calculateSettlements({ entries: result.document.incomeEntries, payments: result.document.taxPayments, taxYear: 2026, today: "2026-09-28" }).find(({ period }) => period === "2026-03")?.status).toBe("paid");
  });

  it("confirms the effective full Opłaty total through the current month", () => {
    const initial = doc();
    const secondApartment = { ...property, id: "second", address: "Druga 2", mediaAmount: "200.00", rentSchedule: [{ ...property.rentSchedule[0]!, mediaAmount: "200.00" }] };
    initial.properties = [property, secondApartment];
    initial.billPayments = [{ id: "existing-media", billId: "apartment-media", period: "2026-03", paidAt: "2026-03-20", amount: "500.00" }];
    const result = bootstrapHistoricalRentPayments({ document: initial, property: secondApartment, startMonth: "2026-03", endMonth: "2026-09", today: "2026-09-28" });
    expect(result.document.billPayments).toHaveLength(7);
    expect(result.document.billPayments.find(({ period }) => period === "2026-03")).toEqual({ id: "existing-media", billId: "apartment-media", period: "2026-03", paidAt: "2026-03-20", amount: "700.00" });
    expect(result.document.billPayments.find(({ period }) => period === "2026-09")).toMatchObject({ amount: "700.00", paidAt: "2026-09-28" });
  });

  it("does not create Opłaty confirmations when no media is paid by the tenant", () => {
    const noMedia = { ...property, mediaAmount: "500.00", mediaPaidByTenant: false, rentSchedule: [{ ...property.rentSchedule[0]!, mediaPaidByTenant: false }] };
    const initial = doc();
    initial.properties = [noMedia];
    const result = bootstrapHistoricalRentPayments({ document: initial, property: noMedia, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(result.document.billPayments).toEqual([]);
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

  it("adds an assumed tax top-up when a new apartment increases a manually settled month", () => {
    const initial = doc();
    const firstProperty = { ...property, rentalStartDate: "2026-03-01" };
    const secondProperty = { ...property, id: "second", address: "Druga 2", rentalStartDate: "2026-03-01" };
    initial.properties = [firstProperty, secondProperty];
    const first = bootstrapHistoricalRentPayments({ document: initial, property: firstProperty, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    const firstSettlement = calculateSettlements({ entries: first.document.incomeEntries, payments: [], taxYear: 2026 }).find(({ period }) => period === "2026-03")!;
    const manuallySettled = { ...first.document, taxPayments: [{ id: "manual-tax", period: "2026-03", paidAt: "2026-04-20", amount: decimalFromGrosz(firstSettlement.obligationGrosz), source: "MANUAL" as const }] };
    const second = bootstrapHistoricalRentPayments({ document: manuallySettled, property: secondProperty, startMonth: "2026-03", endMonth: "2026-03", today: "2026-09-28" });
    expect(second.document.taxPayments).toHaveLength(2);
    expect(second.document.taxPayments.find(({ source }) => source === "MANUAL")).toEqual(manuallySettled.taxPayments[0]);
    expect(calculateSettlements({ entries: second.document.incomeEntries, payments: second.document.taxPayments, taxYear: 2026 }).find(({ period }) => period === "2026-03")?.outstandingGrosz).toBe(0);
  });

  it("skips pre-existing months and future months while including the current month", () => {
    const initial = doc();
    initial.properties = [property];
    initial.incomeEntries = [{ id: "existing", propertyId: property.id, receivedAt: "2026-04-10", rentalMonth: "2026-04", amount: "3000.00", taxableAmount: "2500.00" }];
    const result = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-12", today: "2026-09-28" });
    expect(result.created.map(({ rentalMonth }) => rentalMonth)).toEqual(["2026-03", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(result.skippedMonths).toContain("2026-04");
    expect(result.created.some(({ rentalMonth }) => rentalMonth! > "2026-09")).toBe(false);
    expect(result.document.taxPayments.find(({ period }) => period === "2026-09")?.paidAt).toBe("2026-09-28");
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
  it("updates existing generated historical confirmations without duplicating them", () => {
    const secondProperty = { ...property, id: "p2", address: "Second" };
    const initial = { ...doc(), properties: [property, secondProperty] };
    const first = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-04", today: "2026-10-19" });
    const original = first.document.taxPayments.find((payment) => payment.period === "2026-03")!;
    const second = bootstrapHistoricalRentPayments({ document: first.document, property: secondProperty, startMonth: "2026-04", endMonth: "2026-04", today: "2026-10-19" });
    expect(second.document.taxPayments.filter((payment) => payment.period === "2026-04")).toHaveLength(1);
    expect(second.document.taxPayments.find((payment) => payment.period === "2026-03")).toEqual(original);
    expect(second.document.taxPayments.find((payment) => payment.period === "2026-04")?.amount).toBe("425.00");
    expect(second.document.taxPayments.some((payment) => payment.period === "2026-10")).toBe(false);
  });

  it("preserves manual payments when importing another apartment", () => {
    const secondProperty = { ...property, id: "p2", address: "Second" };
    const initial = { ...doc(), properties: [property, secondProperty] };
    const first = bootstrapHistoricalRentPayments({ document: initial, property, startMonth: "2026-03", endMonth: "2026-03", today: "2026-10-19" });
    const manual = { id: "bank-1", period: "2026-03", paidAt: "2026-04-20", amount: "213.00" };
    const next = bootstrapHistoricalRentPayments({ document: { ...first.document, taxPayments: [manual] }, property: secondProperty, startMonth: "2026-03", endMonth: "2026-03", today: "2026-10-19" });
    expect(next.document.taxPayments).toEqual([manual]);
  });

});
