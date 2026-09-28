import type { AdministrationSuggestion } from "../model/rental";

export const ELECTRICITY_PROVIDER_PRESETS = [
  { name: "TAURON", url: "https://www.tauron.pl/dla-domu" },
  { name: "PGE", url: "https://www.gkpge.pl/dla-domu/strefa-klienta" },
  { name: "Enea", url: "https://www.enea.pl/" },
  { name: "Energa", url: "https://www.energa.pl/dom/obsluga" },
  { name: "E.ON", url: "https://eon.pl/dla-domu" },
] as const;

export function newApartmentDefaults() {
  return { leaseEndDate: "", paymentDay: 5 };
}

export function mergeAdministrationSuggestions(
  suggestions: AdministrationSuggestion[],
  next: AdministrationSuggestion,
): AdministrationSuggestion[] {
  const key = next.name.trim().toLocaleLowerCase("pl-PL");
  if (!key) return suggestions;
  const existing = suggestions.find((item) => item.name.trim().toLocaleLowerCase("pl-PL") === key);
  const value = { name: existing?.name ?? next.name.trim(), ...(next.url || existing?.url ? { url: next.url || existing?.url } : {}) };
  return existing
    ? suggestions.map((item) => item.name.trim().toLocaleLowerCase("pl-PL") === key ? value : item)
    : [...suggestions, value];
}
