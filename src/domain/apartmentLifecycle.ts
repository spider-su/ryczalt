import type { Property, RentalDocument } from "../model/rental";

export type ApartmentLifecycle = "ACTIVE" | "PAUSED" | "ARCHIVED";

export function setApartmentLifecycle(document: RentalDocument, propertyId: string, lifecycle: ApartmentLifecycle): RentalDocument {
  return { ...document, properties: document.properties.map((property) => property.id === propertyId ? { ...property, lifecycle } : property) };
}

export function effectiveLifecycle(property: Property): ApartmentLifecycle {
  return property.lifecycle ?? "ACTIVE";
}
