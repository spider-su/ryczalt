import type { ApartmentLifecycleRate, Property, RentalDocument } from "../model/rental";
import { todayInPoland } from "./ryczaltTax";

export type ApartmentLifecycle = "ACTIVE" | "PAUSED" | "ARCHIVED";

export function setApartmentLifecycle(document: RentalDocument, propertyId: string, lifecycle: ApartmentLifecycle, effectiveFrom = todayInPoland().slice(0, 7)): RentalDocument {
  const target = document.properties.find((property) => property.id === propertyId);
  if (!target) throw new Error("Apartment does not exist");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveFrom)) throw new Error("Lifecycle effective month is invalid");
  if (effectiveLifecycle(target) === "ARCHIVED" && lifecycle !== "ARCHIVED") throw new Error("Archived apartments cannot be reactivated");
  const existing = target.lifecycleSchedule ?? [];
  const lifecycleSchedule: ApartmentLifecycleRate[] = [
    ...existing.filter((item) => item.effectiveFrom !== effectiveFrom && (lifecycle !== "ARCHIVED" || item.effectiveFrom < effectiveFrom)),
    { effectiveFrom, lifecycle },
  ].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  return { ...document, properties: document.properties.map((property) => property.id === propertyId ? { ...property, lifecycle, lifecycleSchedule } : property) };
}

export function effectiveLifecycle(property: Property): ApartmentLifecycle {
  return property.lifecycle ?? "ACTIVE";
}

export function lifecycleForMonth(property: Property, month: string): ApartmentLifecycle {
  const schedule = [...(property.lifecycleSchedule ?? [])].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return schedule.find((item) => item.effectiveFrom <= month)?.lifecycle ?? (property.lifecycleSchedule?.length ? "ACTIVE" : effectiveLifecycle(property));
}
