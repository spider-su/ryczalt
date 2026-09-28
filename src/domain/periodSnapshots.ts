import type { RentalDocument, TaxSettlementSnapshot } from "../model/rental";
import { apartmentTermsForMonth } from "./apartmentTerms";
import { lifecycleForMonth } from "./apartmentLifecycle";
import { expectedRentForMonth } from "./rentAllocation";
import { calculateSettlements, hasTaxRulesForYear, moneyToGrosz, type Settlement } from "./ryczaltTax";
import { decimalFromGrosz } from "./apartmentPayments";
import { isRentalMonth } from "./rentalValidation";

/** Closes an ended calendar month exactly once; later settings edits do not rewrite it. */
export function closeRentalMonth(document: RentalDocument, month: string, now = new Date()): RentalDocument {
  if (!isRentalMonth(month) || month >= localMonth(now)) throw new Error("Only a completed month can be closed");
  const taxYear = Number(month.slice(0, 4));
  if (!hasTaxRulesForYear(taxYear)) throw new Error(`Tax rules for ${taxYear} are not available`);
  if (document.settings.settlementMode !== "monthly") throw new Error("Quarterly tax periods are read-only in this version");
  const apartmentPeriods = [...(document.apartmentPeriods ?? [])];
  const taxSettlementSnapshots: TaxSettlementSnapshot[] = document.taxSettlementSnapshots ?? [];
  const closedAt = now.toISOString();
  const calculatedTax = calculateSettlements({
    entries: document.incomeEntries,
    payments: document.taxPayments,
    taxYear,
    mode: "monthly",
    jointSpouseThreshold: document.settings.jointSpouseThreshold,
    openingTaxableRevenueGrosz: taxYear === document.settings.taxYear && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0,
    openingTaxPaidGrosz: taxYear === document.settings.taxYear && document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0,
    today: localDate(now),
  });
  for (let cursor = `${taxYear}-01`; cursor <= month; cursor = shiftMonth(cursor, 1)) {
    for (const property of document.properties) {
      if (apartmentPeriods.some((snapshot) => snapshot.propertyId === property.id && snapshot.month === cursor)) continue;
      const receipts = document.incomeEntries.filter((entry) => entry.propertyId === property.id && (entry.rentalMonth ?? entry.receivedAt.slice(0, 7)) === cursor);
      const terms = apartmentTermsForMonth(property, cursor);
      const expected = expectedRentForMonth(property, cursor, now);
      if (!receipts.length && expected === null && lifecycleForMonth(property, cursor) !== "PAUSED") continue;
      apartmentPeriods.push({
        propertyId: property.id,
        month: cursor,
        ...(terms ? { ownerRent: decimalFromGrosz(terms.ownerRentGrosz) } : {}),
        ...(expected !== null ? { expectedAmount: decimalFromGrosz(expected) } : {}),
        expectedKnown: expected !== null,
        confirmedAmount: decimalFromGrosz(receipts.reduce((sum, entry) => sum + moneyToGrosz(entry.amount), 0)),
        taxableAmount: decimalFromGrosz(receipts.reduce((sum, entry) => sum + moneyToGrosz(entry.taxableAmount), 0)),
        receiptIds: receipts.map((entry) => entry.id),
        closedAt,
      });
    }
    if (!taxSettlementSnapshots.some((snapshot) => snapshot.period === cursor)) {
      const settlement = calculatedTax.find((item) => item.period === cursor);
      if (!settlement) throw new Error("Tax period could not be calculated");
      const receiptIds = document.incomeEntries.filter((entry) => entry.receivedAt.startsWith(`${cursor}-`)).map((entry) => entry.id);
      const taxPaymentIds = document.taxPayments.filter((payment) => payment.period === cursor).map((payment) => payment.id);
      taxSettlementSnapshots.push(taxSnapshotFromSettlement(settlement, receiptIds, taxPaymentIds, closedAt, taxYear));
    }
  }
  return { ...document, apartmentPeriods, taxSettlementSnapshots };
}

/** Recalculate only saved settlements impacted by a newly recorded tax payment. */
export function refreshSavedTaxSettlementsAfterPayment(document: RentalDocument, firstAffectedPeriod: string, now = new Date()): RentalDocument {
  if (document.settings.settlementMode !== "monthly") return document;
  const year = Number(firstAffectedPeriod.slice(0, 4));
  const saved = document.taxSettlementSnapshots ?? [];
  if (!saved.some((snapshot) => snapshot.rulesYear === year && snapshot.period >= firstAffectedPeriod)) return document;
  const calculated = calculateSettlements({
    entries: document.incomeEntries,
    payments: document.taxPayments,
    taxYear: year,
    mode: "monthly",
    jointSpouseThreshold: document.settings.jointSpouseThreshold,
    openingTaxableRevenueGrosz: document.settings.taxYear === year && document.settings.openingTaxableRevenue ? moneyToGrosz(document.settings.openingTaxableRevenue) : 0,
    openingTaxPaidGrosz: document.settings.taxYear === year && document.settings.openingTaxPaid ? moneyToGrosz(document.settings.openingTaxPaid) : 0,
    today: localDate(now),
  });
  const taxSettlementSnapshots = saved.map((snapshot) => {
    if (snapshot.rulesYear !== year || snapshot.period < firstAffectedPeriod) return snapshot;
    const settlement = calculated.find((item) => item.period === snapshot.period);
    if (!settlement) return snapshot;
    const receiptIds = document.incomeEntries.filter((entry) => entry.receivedAt.startsWith(`${snapshot.period}-`)).map((entry) => entry.id);
    const taxPaymentIds = document.taxPayments.filter((payment) => payment.period === snapshot.period).map((payment) => payment.id);
    return taxSnapshotFromSettlement(settlement, receiptIds, taxPaymentIds, now.toISOString(), year);
  });
  return { ...document, taxSettlementSnapshots };
}

export function taxSettlementFromSnapshot(snapshot: TaxSettlementSnapshot, today: string): Settlement {
  const obligationGrosz = moneyToGrosz(snapshot.obligation);
  const outstandingGrosz = moneyToGrosz(snapshot.outstanding);
  const status: Settlement["status"] = obligationGrosz === 0 ? "no-tax" : outstandingGrosz === 0 ? "paid" : today > snapshot.dueDate ? "overdue" : outstandingGrosz < obligationGrosz ? "partial" : "due";
  return {
    period: snapshot.period,
    revenueGrosz: moneyToGrosz(snapshot.revenue),
    taxableBaseGrosz: moneyToGrosz(snapshot.taxableBase),
    cumulativeRevenueGrosz: moneyToGrosz(snapshot.cumulativeRevenue),
    obligationGrosz,
    cumulativeTaxGrosz: moneyToGrosz(snapshot.cumulativeTax),
    allocatedPaidGrosz: moneyToGrosz(snapshot.allocatedPaid),
    paidGrosz: moneyToGrosz(snapshot.paid),
    creditAppliedGrosz: moneyToGrosz(snapshot.creditApplied),
    outstandingGrosz,
    overpaidGrosz: moneyToGrosz(snapshot.overpaid),
    dueDate: snapshot.dueDate,
    status,
  };
}

function taxSnapshotFromSettlement(settlement: ReturnType<typeof calculateSettlements>[number], receiptIds: string[], taxPaymentIds: string[], savedAt: string, rulesYear: number): TaxSettlementSnapshot {
  return {
    period: settlement.period,
    revenue: decimalFromGrosz(settlement.revenueGrosz),
    taxableBase: decimalFromGrosz(settlement.taxableBaseGrosz),
    cumulativeRevenue: decimalFromGrosz(settlement.cumulativeRevenueGrosz),
    cumulativeTax: decimalFromGrosz(settlement.cumulativeTaxGrosz),
    obligation: decimalFromGrosz(settlement.obligationGrosz),
    paid: decimalFromGrosz(settlement.paidGrosz),
    allocatedPaid: decimalFromGrosz(settlement.allocatedPaidGrosz),
    creditApplied: decimalFromGrosz(settlement.creditAppliedGrosz),
    outstanding: decimalFromGrosz(settlement.outstandingGrosz),
    overpaid: decimalFromGrosz(settlement.overpaidGrosz),
    dueDate: settlement.dueDate,
    rulesYear,
    receiptIds,
    taxPaymentIds,
    savedAt,
  };
}

function localMonth(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function localDate(date: Date) { return `${localMonth(date)}-${String(date.getDate()).padStart(2, "0")}`; }
function shiftMonth(month: string, delta: number) {
  const [year, part] = month.split("-").map(Number);
  const date = new Date(year!, part! - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
