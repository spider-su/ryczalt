import type { IncomeEntry, Property } from "../model/rental";

export function currentRentalMonth(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Years with meaningful income history, plus the current year for new activity. */
export function availableIncomeYears(properties: Property[], entries: IncomeEntry[], openingRevenueYear?: number, now = new Date()) {
  const currentYear = now.getFullYear();
  const years = new Set<number>([currentYear]);
  const addYear = (value: string | undefined) => {
    const match = value?.match(/^(\d{4})(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/);
    const year = match ? Number(match[1]) : NaN;
    if (Number.isInteger(year) && year <= currentYear) years.add(year);
  };
  entries.forEach((entry) => addYear(entry.receivedAt));
  properties.forEach((property) => {
    addYear(property.rentalStartDate);
    property.rentSchedule?.forEach((rate) => addYear(rate.effectiveFrom));
  });
  if (openingRevenueYear !== undefined && openingRevenueYear <= currentYear) years.add(openingRevenueYear);
  return [...years].sort((left, right) => left - right);
}

/** Earliest month with rental history or an explicitly tracked rental period. */
export function earliestDashboardMonth(properties: Property[], entries: IncomeEntry[], now = new Date(), fallbackMonth = `${now.getFullYear()}-01`) {
  const candidates = [
    ...properties.flatMap((property) => {
      if (property.rentalStartDate) return [property.rentalStartDate.slice(0, 7)];
      const scheduleMonths = (property.rentSchedule ?? []).map((rate) => rate.effectiveFrom);
      const propertyEntries = entries.filter((entry) => entry.propertyId === property.id)
        .flatMap((entry) => [entry.rentalMonth, entry.receivedAt.slice(0, 7)]);
      return [...scheduleMonths, ...propertyEntries];
    }),
  ].filter((month): month is string => Boolean(month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)));
  return candidates.length ? candidates.sort()[0]! : fallbackMonth;
}

export function shiftDashboardMonth(month: string, offset: number, now = new Date(), earliestMonth = "0000-01") {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year!, monthNumber! - 1 + offset, 1);
  const shifted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return shifted > currentRentalMonth(now) ? currentRentalMonth(now) : shifted < earliestMonth ? earliestMonth : shifted;
}

export function dashboardMonthsForYear(year: number, now = new Date(), earliestMonth = "0000-01") {
  const currentYear = now.getFullYear();
  if (year > currentYear) return [];
  const lastMonth = year === currentYear ? now.getMonth() + 1 : 12;
  return Array.from({ length: lastMonth }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`)
    .filter((month) => month >= earliestMonth);
}
